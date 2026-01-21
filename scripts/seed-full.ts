/**
 * Comprehensive database seeder
 * Creates realistic demo data:
 * - 10 properties with 10-30 rooms each
 * - 90% rooms occupied
 * - 25% tenants = 1 year, 75% < 1 year
 * - Random billing + kWh data
 * 
 * Run: npx tsx scripts/seed-full.ts
 */
import 'dotenv/config'
import { db } from '../server/utils/drizzle'
import {
  users,
  properties,
  propertySettings,
  tenants,
  rooms,
  rentBills,
  utilityBills,
  meterReadings,
  globalSettings,
  whatsappTemplates,
  expenseCategories,
} from '../server/database/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcrypt'

// ============= HELPERS =============
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min
const randomFloat = (min: number, max: number) => +(Math.random() * (max - min) + min).toFixed(2)
const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const randomPhone = () => `08${randomInt(1, 9)}${String(randomInt(10000000, 99999999))}`
const randomKTP = () => String(randomInt(1000000000000000, 9999999999999999))

const propertyNames = [
  'Kost Harmoni Residence', 'Kost Sejahtera', 'Kost Putra Mandiri',
  'Kost Putri Anggun', 'Kost Mulia Jaya', 'Kost Berkah Sentosa',
  'Kost Griya Asri', 'Kost Cendana Indah', 'Kost Mawar Residence',
  'Kost Melati Premium'
]

const firstNames = [
  'Budi', 'Andi', 'Rizky', 'Dimas', 'Fajar', 'Gilang', 'Hendra', 'Ivan', 'Joko', 'Kurnia',
  'Luthfi', 'Maulana', 'Nanda', 'Oscar', 'Pratama', 'Qori', 'Rendi', 'Satria', 'Taufik', 'Umar',
  'Siti', 'Dewi', 'Putri', 'Anisa', 'Bella', 'Citra', 'Diana', 'Eka', 'Fitri', 'Gita',
  'Hana', 'Indah', 'Jasmine', 'Kartika', 'Lina', 'Maya', 'Nia', 'Oktavia', 'Priska', 'Ratna'
]

const lastNames = [
  'Pratama', 'Wijaya', 'Kusuma', 'Santoso', 'Hidayat', 'Saputra', 'Wibowo', 'Nugroho', 'Setiawan', 'Putra',
  'Sari', 'Utami', 'Rahayu', 'Anggraini', 'Permata', 'Lestari', 'Maharani', 'Safitri', 'Wulandari', 'Hartono'
]

const addresses = [
  'Jl. Sudirman No. 123, Jakarta Pusat',
  'Jl. Gatot Subroto Kav. 45, Jakarta Selatan',
  'Jl. Ahmad Yani No. 67, Bandung',
  'Jl. Diponegoro No. 89, Surabaya',
  'Jl. Malioboro No. 12, Yogyakarta',
  'Jl. Asia Afrika No. 34, Bandung',
  'Jl. Pemuda No. 56, Semarang',
  'Jl. Veteran No. 78, Malang',
  'Jl. Pahlawan No. 90, Denpasar',
  'Jl. Merdeka No. 101, Medan'
]

const paymentMethods = ['cash', 'transfer', 'e_wallet'] as ('cash' | 'transfer' | 'e_wallet')[]

// ============= SEEDER =============
async function seedFull() {
  console.log('🌱 Starting comprehensive database seed...\n')

  // Get or create user
  let [user] = await db.select().from(users).limit(1)
  
  if (!user) {
    console.log('📧 Creating default admin user...')
    const hashedPassword = await bcrypt.hash('admin123', 10)
    const [newUser] = await db.insert(users).values({
      email: 'admin@kostman.com',
      password: hashedPassword,
      name: 'Administrator',
      role: 'owner'
    }).returning()
    user = newUser
  }
  console.log(`👤 Using user: ${user.email}`)

  // Create global settings
  console.log('\n⚙️  Creating global settings...')
  await db.delete(globalSettings).where(eq(globalSettings.userId, user.id))
  await db.insert(globalSettings).values({
    userId: user.id,
    appName: 'KostMan Demo',
    costPerKwh: '1500',
    waterFee: '50000',
    trashFee: '25000'
  })

  // Create expense categories
  console.log('📂 Creating expense categories...')
  await db.delete(expenseCategories).where(eq(expenseCategories.userId, user.id))
  const categories = ['Listrik PLN', 'Air PDAM', 'Internet', 'Keamanan', 'Kebersihan', 'Perbaikan', 'Lainnya']
  for (const cat of categories) {
    await db.insert(expenseCategories).values({
      userId: user.id,
      name: cat,
      color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`
    })
  }

  // Create WhatsApp templates
  console.log('📱 Creating WhatsApp templates...')
  await db.delete(whatsappTemplates).where(eq(whatsappTemplates.userId, user.id))
  const waTemplates = [
    { name: 'Tagihan Bulanan', type: 'billing' as const, msg: 'Halo {nama_penyewa},\n\nBerikut tagihan kost Anda:\n\n{detail_tagihan}\n\n{link_pembayaran}\n\nMohon segera melakukan pembayaran.\nTerima kasih. 🙏' },
    { name: 'Reminder Overdue', type: 'reminder_overdue' as const, msg: 'Halo {nama_penyewa},\n\n⚠️ *PEMBERITAHUAN PENTING*\n\nTagihan Anda sudah *LEWAT JATUH TEMPO*.\n\n{detail_tagihan}\n\n{link_pembayaran}\n\nMohon segera melakukan pembayaran.\nTerima kasih. 🙏' },
    { name: 'Reminder Due Soon', type: 'reminder_due_soon' as const, msg: 'Halo {nama_penyewa},\n\n🔔 *PENGINGAT*\n\nTagihan Anda akan segera jatuh tempo.\n\n{detail_tagihan}\n\n{link_pembayaran}\n\nSilakan lakukan pembayaran sebelum jatuh tempo.\nTerima kasih! 😊' },
    { name: 'Template Umum', type: 'general' as const, msg: 'Halo {nama_penyewa},\n\n{detail_tagihan}\n\n{link_pembayaran}\n\nTerima kasih. 🙏' }
  ]
  for (const t of waTemplates) {
    await db.insert(whatsappTemplates).values({
      userId: user.id,
      name: t.name,
      templateType: t.type,
      message: t.msg,
      isDefault: true
    })
  }

  // ============= PROPERTIES & ROOMS =============
  console.log('\n🏠 Creating properties, rooms, tenants, and bills...\n')
  
  const today = new Date()
  const createdTenantIds: string[] = []
  const createdRoomData: { roomId: string; tenantId: string; moveInDate: Date; propertyId: string; price: number }[] = []

  for (let p = 0; p < 10; p++) {
    const propName = propertyNames[p]
    const roomCount = randomInt(10, 30)
    const occupiedCount = Math.floor(roomCount * 0.9) // 90% occupied
    
    console.log(`📍 ${propName} (${roomCount} rooms, ${occupiedCount} occupied)`)

    // Create property
    const [property] = await db.insert(properties).values({
      userId: user.id,
      name: propName,
      address: addresses[p],
      description: `${propName} - Kost nyaman dan strategis dengan fasilitas lengkap.`
    }).returning()

    // Create property settings (varied rates per property)
    const costPerKwh = randomInt(1400, 1700)
    const waterFee = randomInt(40000, 60000)
    const trashFee = randomInt(20000, 35000)
    
    await db.insert(propertySettings).values({
      propertyId: property.id,
      costPerKwh: String(costPerKwh),
      waterFee: String(waterFee),
      trashFee: String(trashFee)
    })

    // Create rooms
    for (let r = 1; r <= roomCount; r++) {
      const roomName = `Kamar ${String(r).padStart(2, '0')}`
      const roomPrice = randomInt(8, 20) * 100000 // 800k - 2M
      const isOccupied = r <= occupiedCount

      let tenantId: string | null = null
      let moveInDate: Date | null = null

      if (isOccupied) {
        // Create tenant
        const firstName = randomChoice(firstNames)
        const lastName = randomChoice(lastNames)
        const tenantName = `${firstName} ${lastName}`

        // 25% tenants = 1 year, 75% < 1 year
        const isLongTerm = Math.random() < 0.25
        const monthsAgo = isLongTerm ? 12 : randomInt(1, 11)
        moveInDate = new Date(today)
        moveInDate.setMonth(moveInDate.getMonth() - monthsAgo)
        moveInDate.setDate(randomInt(1, 28)) // Random day of month

        const [tenant] = await db.insert(tenants).values({
          name: tenantName,
          contact: randomPhone(),
          idCardNumber: randomKTP(),
          status: 'active'
        }).returning()

        tenantId = tenant.id
        createdTenantIds.push(tenant.id)
        createdRoomData.push({ roomId: '', tenantId: tenant.id, moveInDate, propertyId: property.id, price: roomPrice })
      }

      const [room] = await db.insert(rooms).values({
        propertyId: property.id,
        tenantId,
        name: roomName,
        price: String(roomPrice),
        status: isOccupied ? 'occupied' : (Math.random() < 0.1 ? 'maintenance' : 'available'),
        useTrashService: Math.random() > 0.1, // 90% use trash service
        moveInDate: moveInDate ? moveInDate.toISOString().split('T')[0] : null,
        occupantCount: isOccupied ? randomInt(1, 2) : 1
      }).returning()

      // Update roomId in data
      if (tenantId) {
        const idx = createdRoomData.findIndex(d => d.tenantId === tenantId && !d.roomId)
        if (idx >= 0) createdRoomData[idx].roomId = room.id
      }
    }
  }

  // ============= BILLING DATA =============
  console.log('\n💰 Creating billing data...\n')

  for (const data of createdRoomData) {
    const { roomId, tenantId, moveInDate, price } = data
    
    // Get room with occupant count
    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId))
    const occupantCount = room?.occupantCount || 1

    // Get property settings
    const [propSetting] = await db.select().from(propertySettings).where(eq(propertySettings.propertyId, data.propertyId))
    const costPerKwh = Number(propSetting?.costPerKwh || 1500)
    const waterFee = Number(propSetting?.waterFee || 50000)
    const trashFee = Number(propSetting?.trashFee || 25000)

    // Generate bills from move-in date to now
    const startDate = new Date(moveInDate)
    const current = new Date(today)
    
    let meterValue = randomInt(1000, 5000) // Initial meter reading

    while (startDate <= current) {
      const year = startDate.getFullYear()
      const month = startDate.getMonth()
      const period = `${year}-${String(month + 1).padStart(2, '0')}`
      
      // Calculate period dates (ensure midnight to avoid timezone issues)
      const periodStart = new Date(year, month, moveInDate.getDate(), 0, 0, 0, 0)
      const periodEnd = new Date(year, month + 1, moveInDate.getDate() - 1, 0, 0, 0, 0)
      const dueDate = new Date(year, month, moveInDate.getDate() + 7, 0, 0, 0, 0)

      // Payment status - older bills more likely paid
      const monthsAgo = (today.getFullYear() - year) * 12 + (today.getMonth() - month)
      const isPaidRent = monthsAgo > 1 ? Math.random() > 0.1 : Math.random() > 0.4 // 90% paid if old, 60% if recent
      const isPaidUtil = monthsAgo > 1 ? Math.random() > 0.15 : Math.random() > 0.5

      // Rent Bill
      const rentTotal = price
      await db.insert(rentBills).values({
        roomId,
        tenantId,
        periodStartDate: periodStart.toISOString().split('T')[0],
        periodEndDate: periodEnd.toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        billingCycleDay: moveInDate.getDate(),
        period,
        monthsCovered: 1,
        roomPrice: String(price),
        waterFee: '0', // Water in utility bill
        trashFee: '0',
        totalAmount: String(rentTotal),
        isPaid: isPaidRent,
        paymentMethod: isPaidRent ? randomChoice(paymentMethods) : null,
        paidAt: isPaidRent ? new Date(periodStart.getTime() + randomInt(1, 20) * 86400000) : null,
        generatedAt: periodStart
      })

      // Utility Bill - with realistic kWh usage
      const kwhUsage = randomInt(30, 150) // 30-150 kWh per month
      const meterEnd = meterValue + kwhUsage
      const usageCost = kwhUsage * costPerKwh
      const totalWater = waterFee * occupantCount
      const utilTotal = usageCost + totalWater + (room?.useTrashService ? trashFee : 0)

      await db.insert(utilityBills).values({
        roomId,
        tenantId,
        period,
        meterStart: meterValue,
        meterEnd,
        costPerKwh: String(costPerKwh),
        usageCost: String(usageCost),
        waterFee: String(totalWater),
        trashFee: String(room?.useTrashService ? trashFee : 0),
        additionalCost: '0',
        totalAmount: String(utilTotal),
        isPaid: isPaidUtil,
        paymentMethod: isPaidUtil ? randomChoice(paymentMethods) : null,
        paidAt: isPaidUtil ? new Date(periodStart.getTime() + randomInt(5, 25) * 86400000) : null,
        generatedAt: periodStart
      })

      // Meter Reading
      await db.insert(meterReadings).values({
        roomId,
        period,
        meterStart: meterValue,
        meterEnd,
        recordedAt: new Date(year, month + 1, randomInt(1, 5)),
        recordedBy: user.id
      })

      meterValue = meterEnd
      startDate.setMonth(startDate.getMonth() + 1)
    }
  }

  // Summary
  const totalRooms = createdRoomData.length + await db.select().from(rooms).then(r => r.filter(x => !x.tenantId).length)
  const totalTenants = createdTenantIds.length
  
  console.log('\n' + '='.repeat(50))
  console.log('🎉 SEED COMPLETE!')
  console.log('='.repeat(50))
  console.log(`📍 Properties: 10`)
  console.log(`🚪 Rooms: ~${totalRooms}`)
  console.log(`👥 Tenants: ${totalTenants}`)
  console.log(`💰 Rent Bills: Many (based on occupancy duration)`)
  console.log(`⚡ Utility Bills: Many (with realistic kWh data)`)
  console.log(`📧 Default login: admin@kostman.com / admin123`)
  console.log('='.repeat(50))
  
  process.exit(0)
}

seedFull().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
