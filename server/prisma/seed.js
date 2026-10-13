import 'dotenv/config'
import { createPrismaClient } from '../src/db.js'

const prisma = createPrismaClient()
const starterSkills = [
  'JavaScript', 'React', 'Node.js', 'Python', 'Java', 'C++', 'SQL', 'PostgreSQL',
  'UI Design', 'Figma', 'Data Structures', 'Machine Learning', 'Research',
  'Product Design', 'APIs', 'Git', 'Writing', 'Public Speaking',
]

try {
  for (const name of starterSkills) {
    await prisma.officialSkill.upsert({ where: { name }, update: {}, create: { name } })
  }
  console.log(`Ensured ${starterSkills.length} starter skills are in the catalogue.`)
} finally {
  await prisma.$disconnect()
}
