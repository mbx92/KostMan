/**
 * Seed default WhatsApp templates
 * Run: npx tsx server/database/seed-wa-templates.ts
 */
import 'dotenv/config'
import { db } from '../utils/drizzle'
import { whatsappTemplates, users } from './schema'
import { eq } from 'drizzle-orm'

const defaultTemplates = [
  {
    name: 'Tagihan Bulanan',
    templateType: 'billing' as const,
    message: `Halo {nama_penyewa},

Berikut tagihan kost Anda:

{detail_tagihan}

{link_pembayaran}

Mohon segera melakukan pembayaran.
Terima kasih.`,
    isDefault: true,
  },
  {
    name: 'Reminder Lewat Jatuh Tempo',
    templateType: 'reminder_overdue' as const,
    message: `Halo {nama_penyewa},

*PEMBERITAHUAN PENTING*

Tagihan Anda sudah *LEWAT JATUH TEMPO*.

{detail_tagihan}

{link_pembayaran}

Mohon segera melakukan pembayaran untuk menghindari denda.
Terima kasih.`,
    isDefault: true,
  },
  {
    name: 'Reminder Jatuh Tempo Segera',
    templateType: 'reminder_due_soon' as const,
    message: `Halo {nama_penyewa},

*PENGINGAT*

Tagihan Anda akan segera jatuh tempo.

{detail_tagihan}

{link_pembayaran}

Silakan lakukan pembayaran sebelum jatuh tempo.
Terima kasih!`,
    isDefault: true,
  },
  {
    name: 'Template Umum',
    templateType: 'general' as const,
    message: `Halo {nama_penyewa},

{detail_tagihan}

{link_pembayaran}

Terima kasih.`,
    isDefault: true,
  },
]

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
