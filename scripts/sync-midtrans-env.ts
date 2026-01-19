import { db } from '../server/utils/drizzle'
import { integrationSettings, users } from '../server/database/schema'
import { encrypt } from '../server/utils/encryption'
import { eq, and } from 'drizzle-orm'
import { config } from 'dotenv'

// Load .env file
config()

/**
 * Script to sync Midtrans credentials from .env to database
 * Run this once to populate initial integration settings
 * 
 * Usage: npx tsx scripts/sync-midtrans-env.ts
 */

async function syncMidtransCredentials() {
  console.log('🔄 Syncing Midtrans credentials from .env to database...')

  const serverKey = process.env.MIDTRANS_SERVER_KEY
  const clientKey = process.env.MIDTRANS_CLIENT_KEY
  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true'

  if (!serverKey || !clientKey) {
    console.log('⚠️  No Midtrans credentials found in .env')
    console.log('   Make sure MIDTRANS_SERVER_KEY and MIDTRANS_CLIENT_KEY are set')
    process.exit(1)
  }

  // Get first user (owner) - adjust logic if you need specific user
  const allUsers = await db.select().from(users).limit(1)
  
  if (allUsers.length === 0) {
    console.error('❌ No users found in database. Create a user first.')
    process.exit(1)
  }

  const user = allUsers[0]
  console.log(`📍 Syncing for user: ${user.email} (${user.id})`)

  // Check if integration already exists
  const existing = await db
    .select()
    .from(integrationSettings)
    .where(
      and(
        eq(integrationSettings.userId, user.id),
        eq(integrationSettings.provider, 'midtrans')
      )
    )
    .then(rows => rows[0])

  if (existing) {
    console.log('⚠️  Midtrans integration already exists for this user')
    console.log('   Updating with values from .env...')
    
    await db
      .update(integrationSettings)
      .set({
        serverKey: encrypt(serverKey),
        clientKey,
        isProduction,
        isEnabled: true,
        updatedAt: new Date()
      })
      .where(eq(integrationSettings.id, existing.id))
    
    console.log('✅ Midtrans integration updated successfully!')
  } else {
    console.log('➕ Creating new Midtrans integration...')
    
    await db
      .insert(integrationSettings)
      .values({
        userId: user.id,
        provider: 'midtrans',
        serverKey: encrypt(serverKey),
        clientKey,
        isProduction,
        isEnabled: true
      })
    
    console.log('✅ Midtrans integration created successfully!')
  }

  console.log('\n📋 Summary:')
  console.log(`   Provider: midtrans`)
  console.log(`   Client Key: ${clientKey}`)
  console.log(`   Server Key: ${serverKey.substring(0, 10)}...`)
  console.log(`   Mode: ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`)
  console.log(`   Status: ENABLED`)
  console.log('\n🎉 Done! You can now see the settings in the UI.')
}

syncMidtransCredentials()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
