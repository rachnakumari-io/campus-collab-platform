import test from 'node:test'
import assert from 'node:assert/strict'
import { postSchema, postType, profileSchema, registerSchema, requestSchema } from '../src/api.js'

test('registration accepts a regular email and college name without asserting enrollment', () => {
  const result = registerSchema.safeParse({ name: 'Riya Menon', email: 'riya@example.com', password: 'long-password', college: 'Example College' })
  assert.equal(result.success, true)
})

test('registration rejects short passwords and invalid email addresses', () => {
  assert.equal(registerSchema.safeParse({ name: 'Riya', email: 'not-an-email', password: 'short', college: 'College' }).success, false)
})

test('post validation only allows the three supported opportunity types', () => {
  for (const type of ['HELP_REQUEST', 'PROJECT_TEAM', 'HACKATHON_TEAM']) assert.equal(postType.safeParse(type).success, true)
  assert.equal(postType.safeParse('RESEARCH_TEAM').success, false)
})

test('post validation enforces title, description, and skill limits', () => {
  const valid = { title: 'Find a project teammate', description: 'Looking for a student to build a useful campus project together.', type: 'PROJECT_TEAM', requiredSkills: ['React'] }
  assert.equal(postSchema.safeParse(valid).success, true)
  assert.equal(postSchema.safeParse({ ...valid, title: 'Hi' }).success, false)
  assert.equal(postSchema.safeParse({ ...valid, requiredSkills: Array(13).fill('Skill') }).success, false)
})

test('profile validation accepts a blank optional portfolio URL and rejects non-URLs', () => {
  const profile = { name: 'Riya Menon', bio: '', skills: [], interests: [], portfolioUrl: '' }
  assert.equal(profileSchema.safeParse(profile).success, true)
  assert.equal(profileSchema.safeParse({ ...profile, portfolioUrl: 'javascript:alert(1)' }).success, false)
})

test('collaboration messages require an introduction with a bounded length', () => {
  assert.equal(requestSchema.safeParse({ postId: 'post-1', message: 'I can help with the frontend and testing.' }).success, true)
  assert.equal(requestSchema.safeParse({ postId: 'post-1', message: 'Hi' }).success, false)
})
