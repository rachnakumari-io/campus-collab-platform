import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { clearSessionCookie, createSessionCookie, requireAdmin, requireAuth } from './auth.js'

const publicStudent = {
  id: true, name: true, bio: true, skills: true, interests: true,
  portfolioUrl: true, createdAt: true,
  college: { select: { id: true, name: true } },
}
const accountStudent = { ...publicStudent, email: true, role: true }

const postInclude = {
  author: { select: publicStudent },
  _count: { select: { requests: true } },
}

export const postType = z.enum(['HELP_REQUEST', 'PROJECT_TEAM', 'HACKATHON_TEAM'])
const trimmedString = (min, max) => z.string().trim().min(min).max(max)
export const registerSchema = z.object({
  name: trimmedString(2, 80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes.'),
  college: trimmedString(2, 120),
})
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(72) })
export const profileSchema = z.object({
  name: trimmedString(2, 80),
  bio: z.string().trim().max(500),
  skills: z.array(trimmedString(1, 40)).max(20),
  interests: z.array(trimmedString(1, 40)).max(20),
  portfolioUrl: z.union([z.string().trim().url().max(300).refine((value) => /^https?:\/\//i.test(value)), z.literal('')]).optional(),
})
export const postSchema = z.object({
  title: trimmedString(5, 120),
  description: trimmedString(20, 2000),
  type: postType,
  requiredSkills: z.array(trimmedString(1, 40)).max(12),
})
export const requestSchema = z.object({ postId: z.string().min(1), message: trimmedString(10, 500) })

function invalid(res, error) {
  return res.status(400).json({ error: error.issues?.[0]?.message ?? 'Please check the submitted information.' })
}

function publicPost(post) {
  return { ...post, requestCount: post._count.requests, _count: undefined }
}

export function createApi(prisma, loginLimiter) {
  const router = Router()

  router.post('/auth/register', loginLimiter, async (req, res) => {
    const parsed = registerSchema.safeParse(req.body)
    if (!parsed.success) return invalid(res, parsed.error)
    const data = parsed.data
    const email = data.email.toLowerCase()
    if (await prisma.student.findUnique({ where: { email }, select: { id: true } })) {
      return res.status(409).json({ error: 'An account with that email already exists.' })
    }

    const college = await prisma.college.upsert({ where: { name: data.college }, update: {}, create: { name: data.college } })
    const student = await prisma.student.create({
      data: { name: data.name, email, passwordHash: await bcrypt.hash(data.password, 12), collegeId: college.id },
      select: accountStudent,
    })
    createSessionCookie(res, student.id)
    return res.status(201).json({ student })
  })

  router.post('/auth/login', loginLimiter, async (req, res) => {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) return invalid(res, parsed.error)
    const student = await prisma.student.findUnique({ where: { email: parsed.data.email.toLowerCase() } })
    if (!student || !(await bcrypt.compare(parsed.data.password, student.passwordHash))) {
      return res.status(401).json({ error: 'Email or password is incorrect.' })
    }
    createSessionCookie(res, student.id)
    const { passwordHash, ...safeStudent } = student
    return res.json({ student: { ...safeStudent, college: await prisma.college.findUnique({ where: { id: student.collegeId }, select: { id: true, name: true } }) } })
  })

  router.post('/auth/logout', (_req, res) => {
    clearSessionCookie(res)
    return res.json({ message: 'You are logged out.' })
  })

  router.get('/auth/me', requireAuth, async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.studentId }, select: accountStudent })
    if (!student) return res.status(401).json({ error: 'Account not found.' })
    return res.json({ student })
  })

  router.get('/skills', requireAuth, async (_req, res) => {
    const skills = await prisma.officialSkill.findMany({ orderBy: { name: 'asc' } })
    return res.json({ skills, suggestions: await prisma.skillSuggestion.findMany({ where: { status: 'APPROVED' }, select: { name: true }, orderBy: { name: 'asc' } }) })
  })

  router.post('/skills/suggestions', requireAuth, async (req, res) => {
    const parsed = z.object({ name: trimmedString(2, 40) }).safeParse(req.body)
    if (!parsed.success) return invalid(res, parsed.error)
    const name = parsed.data.name
    if (await prisma.officialSkill.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } })) {
      return res.status(409).json({ error: 'That skill is already in the catalogue.' })
    }
    try {
      const suggestion = await prisma.skillSuggestion.create({ data: { name, studentId: req.studentId } })
      return res.status(201).json({ suggestion })
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'That skill has already been suggested.' })
      throw error
    }
  })

  router.get('/admin/skills/suggestions', requireAuth, requireAdmin(prisma), async (_req, res) => {
    return res.json({ suggestions: await prisma.skillSuggestion.findMany({ where: { status: 'PENDING' }, include: { student: { select: { id: true, name: true, college: { select: { name: true } } } } }, orderBy: { createdAt: 'asc' } }) })
  })

  router.patch('/admin/skills/suggestions/:id', requireAuth, requireAdmin(prisma), async (req, res) => {
    const parsed = z.object({ status: z.enum(['APPROVED', 'REJECTED']) }).safeParse(req.body)
    if (!parsed.success) return invalid(res, parsed.error)
    const suggestion = await prisma.skillSuggestion.findUnique({ where: { id: req.params.id } })
    if (!suggestion) return res.status(404).json({ error: 'Skill suggestion not found.' })
    if (suggestion.status !== 'PENDING') return res.status(409).json({ error: 'This suggestion was already reviewed.' })
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.skillSuggestion.update({ where: { id: suggestion.id }, data: { status: parsed.data.status } })
      if (parsed.data.status === 'APPROVED') await tx.officialSkill.upsert({ where: { name: suggestion.name }, update: {}, create: { name: suggestion.name } })
      return result
    })
    return res.json({ suggestion: updated })
  })

  router.get('/profiles', requireAuth, async (req, res) => {
    const query = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const currentStudent = await prisma.student.findUnique({ where: { id: req.studentId }, select: { collegeId: true } })
    const students = await prisma.student.findMany({ where: { id: { not: req.studentId }, collegeId: currentStudent.collegeId }, select: publicStudent, orderBy: { name: 'asc' }, take: 100 })
    const normalizedQuery = query.toLowerCase()
    const filtered = normalizedQuery ? students.filter((person) => [person.name, person.bio, person.college.name, ...person.skills, ...person.interests].some((value) => value.toLowerCase().includes(normalizedQuery))) : students
    return res.json({ students: filtered.slice(0, 50) })
  })

  router.get('/profiles/me', requireAuth, async (req, res) => {
    return res.json({ student: await prisma.student.findUnique({ where: { id: req.studentId }, select: accountStudent }) })
  })

  router.patch('/profiles/me', requireAuth, async (req, res) => {
    const parsed = profileSchema.safeParse(req.body)
    if (!parsed.success) return invalid(res, parsed.error)
    const data = parsed.data
    const student = await prisma.student.update({ where: { id: req.studentId }, data: {
      ...data, portfolioUrl: data.portfolioUrl || null,
      skills: [...new Set(data.skills.map((item) => item.trim()))],
      interests: [...new Set(data.interests.map((item) => item.trim()))],
    }, select: accountStudent })
    return res.json({ student })
  })

  router.get('/profiles/:id', requireAuth, async (req, res) => {
    const student = await prisma.student.findUnique({ where: { id: req.params.id }, select: publicStudent })
    if (!student) return res.status(404).json({ error: 'Student profile not found.' })
    const currentStudent = await prisma.student.findUnique({ where: { id: req.studentId }, select: { collegeId: true } })
    if (student.college.id !== currentStudent.collegeId) return res.status(404).json({ error: 'Student profile not found.' })
    return res.json({ student })
  })

  router.get('/posts', requireAuth, async (req, res) => {
    const type = req.query.type
    if (type && type !== 'ALL' && !postType.safeParse(type).success) return res.status(400).json({ error: 'Invalid opportunity type.' })
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const skill = typeof req.query.skill === 'string' ? req.query.skill.trim() : ''
    const currentStudent = await prisma.student.findUnique({ where: { id: req.studentId }, select: { collegeId: true } })
    const posts = await prisma.post.findMany({
      where: { status: req.query.status === 'CLOSED' ? 'CLOSED' : 'OPEN', author: { collegeId: currentStudent.collegeId },
        ...(type && type !== 'ALL' ? { type } : {}),
        ...(skill ? { requiredSkills: { has: skill } } : {}),
      }, include: postInclude, orderBy: { createdAt: 'desc' }, take: 100,
    })
    const normalizedQuery = query.toLowerCase()
    const filtered = normalizedQuery ? posts.filter((post) => [post.title, post.description, post.author.name, ...post.requiredSkills].some((value) => value.toLowerCase().includes(normalizedQuery))) : posts
    return res.json({ posts: filtered.map(publicPost) })
  })

  router.get('/posts/mine', requireAuth, async (req, res) => {
    const posts = await prisma.post.findMany({ where: { authorId: req.studentId }, include: postInclude, orderBy: { createdAt: 'desc' } })
    return res.json({ posts: posts.map(publicPost) })
  })

  router.get('/posts/:id', requireAuth, async (req, res) => {
    const post = await prisma.post.findUnique({ where: { id: req.params.id }, include: postInclude })
    if (!post) return res.status(404).json({ error: 'Opportunity not found.' })
    const currentStudent = await prisma.student.findUnique({ where: { id: req.studentId }, select: { collegeId: true } })
    if (post.author.college.id !== currentStudent.collegeId) return res.status(404).json({ error: 'Opportunity not found.' })
    return res.json({ post: publicPost(post) })
  })

  router.post('/posts', requireAuth, async (req, res) => {
    const parsed = postSchema.safeParse(req.body)
    if (!parsed.success) return invalid(res, parsed.error)
    const post = await prisma.post.create({ data: { ...parsed.data, authorId: req.studentId }, include: postInclude })
    return res.status(201).json({ post: publicPost(post) })
  })

  router.patch('/posts/:id', requireAuth, async (req, res) => {
    const parsed = postSchema.partial().safeParse(req.body)
    if (!parsed.success || Object.keys(req.body ?? {}).length === 0) return parsed.success ? res.status(400).json({ error: 'Enter at least one field to update.' }) : invalid(res, parsed.error)
    const existing = await prisma.post.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Opportunity not found.' })
    if (existing.authorId !== req.studentId) return res.status(403).json({ error: 'You can only edit your own posts.' })
    const post = await prisma.post.update({ where: { id: existing.id }, data: parsed.data, include: postInclude })
    return res.json({ post: publicPost(post) })
  })

  router.patch('/posts/:id/status', requireAuth, async (req, res) => {
    const parsed = z.object({ status: z.enum(['OPEN', 'CLOSED']) }).safeParse(req.body)
    if (!parsed.success) return invalid(res, parsed.error)
    const existing = await prisma.post.findUnique({ where: { id: req.params.id } })
    if (!existing) return res.status(404).json({ error: 'Opportunity not found.' })
    if (existing.authorId !== req.studentId) return res.status(403).json({ error: 'You can only change your own posts.' })
    const post = await prisma.post.update({ where: { id: existing.id }, data: { status: parsed.data.status }, include: postInclude })
    return res.json({ post: publicPost(post) })
  })

  router.post('/requests', requireAuth, async (req, res) => {
    const parsed = requestSchema.safeParse(req.body)
    if (!parsed.success) return invalid(res, parsed.error)
    const post = await prisma.post.findUnique({ where: { id: parsed.data.postId }, select: { id: true, authorId: true, status: true, author: { select: { collegeId: true } } } })
    if (!post) return res.status(404).json({ error: 'Opportunity not found.' })
    if (post.authorId === req.studentId) return res.status(400).json({ error: 'You cannot send a request to your own post.' })
    const currentStudent = await prisma.student.findUnique({ where: { id: req.studentId }, select: { collegeId: true } })
    if (post.author.collegeId !== currentStudent.collegeId) return res.status(404).json({ error: 'Opportunity not found.' })
    if (post.status !== 'OPEN') return res.status(409).json({ error: 'This opportunity is closed.' })
    try {
      const collaborationRequest = await prisma.collaborationRequest.create({ data: { ...parsed.data, requesterId: req.studentId }, include: { post: { select: { id: true, title: true, authorId: true } }, requester: { select: publicStudent } } })
      return res.status(201).json({ request: collaborationRequest })
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ error: 'You already sent a request for this opportunity.' })
      throw error
    }
  })

  router.get('/requests/sent', requireAuth, async (req, res) => {
    return res.json({ requests: await prisma.collaborationRequest.findMany({ where: { requesterId: req.studentId }, include: { post: { include: { author: { select: publicStudent } } } }, orderBy: { createdAt: 'desc' } }) })
  })

  router.get('/requests/received', requireAuth, async (req, res) => {
    return res.json({ requests: await prisma.collaborationRequest.findMany({ where: { post: { authorId: req.studentId } }, include: { requester: { select: publicStudent }, post: { select: { id: true, title: true, status: true } } }, orderBy: { createdAt: 'desc' } }) })
  })

  router.patch('/requests/:id/status', requireAuth, async (req, res) => {
    const parsed = z.object({ status: z.enum(['ACCEPTED', 'REJECTED', 'WITHDRAWN']) }).safeParse(req.body)
    if (!parsed.success) return invalid(res, parsed.error)
    const request = await prisma.collaborationRequest.findUnique({ where: { id: req.params.id }, include: { post: { select: { authorId: true } } } })
    if (!request) return res.status(404).json({ error: 'Collaboration request not found.' })
    if (request.status !== 'PENDING') return res.status(409).json({ error: 'This request has already been handled.' })
    if (parsed.data.status === 'WITHDRAWN' && request.requesterId !== req.studentId) return res.status(403).json({ error: 'Only the sender can withdraw this request.' })
    if (parsed.data.status !== 'WITHDRAWN' && request.post.authorId !== req.studentId) return res.status(403).json({ error: 'Only the post owner can accept or reject this request.' })
    return res.json({ request: await prisma.collaborationRequest.update({ where: { id: request.id }, data: { status: parsed.data.status } }) })
  })

  return router
}
