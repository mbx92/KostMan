/**
 * Seed default WhatsApp templates
 * Run: npx tsx server/database/seed-wa-templates.ts
 */
import 'dotenv/config'
import { db } from '../utils/drizzle'
import { whatsappTemplates, users } from './schema'
import { eq } from 'drizzle-orm'
import { getAllDefaultWhatsAppTemplates } from '../../shared/whatsapp-template-defaults'

const defaultTemplates = getAllDefaultWhatsAppTemplates()

async function seedWhatsAppTemplates() {
  console.log('🌱 Seeding WhatsApp templates...')

  // Get first user (owner)
  const [user] = await db.select().from(users).limit(1)

  if (!user) {
    console.error('❌ No user found. Please seed users first.')
    process.exit(1)
  }

  console.log(`📧 Using user: ${user.email}`)

  // Check for existing templates
  const existing = await db.select().from(whatsappTemplates).where(eq(whatsappTemplates.userId, user.id))

  if (existing.length > 0) {
    console.log(`ℹ️  Found ${existing.length} existing templates.`)
    console.log('   Skipping seed to avoid duplicates.')
    console.log('   Delete existing templates to re-seed.')
    process.exit(0)
  }

  // Insert templates
  for (const template of defaultTemplates) {
    await db.insert(whatsappTemplates).values({
      userId: user.id,
      name: template.name,
      templateType: template.templateType,
      message: template.message,
      isDefault: template.isDefault,
    })
    console.log(`✅ Created: ${template.name} (${template.templateType})`)
  }

  console.log(`\n🎉 Seeded ${defaultTemplates.length} WhatsApp templates!`)
  process.exit(0)
}

seedWhatsAppTemplates().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
