import jwt from 'jsonwebtoken'

const COOKIE_NAME = 'campus_session'
const TOKEN_LIFETIME = '7d'

export function createSessionCookie(res, studentId) {
  const token = jwt.sign({ sub: studentId }, process.env.JWT_SECRET, { expiresIn: TOKEN_LIFETIME })
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return res.status(401).json({ error: 'Please log in to continue.' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.studentId = payload.sub
    return next()
  } catch {
    clearSessionCookie(res)
    return res.status(401).json({ error: 'Your session expired. Please log in again.' })
  }
}

export function requireAdmin(prisma) {
  return async (req, res, next) => {
    const student = await prisma.student.findUnique({ where: { id: req.studentId }, select: { role: true } })
    if (student?.role !== 'ADMIN') return res.status(403).json({ error: 'Administrator access is required.' })
    return next()
  }
}
