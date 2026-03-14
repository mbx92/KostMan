import { createDatabaseBackup } from '../utils/backup'

export default defineNitroPlugin(() => {
  scheduleNightlyBackup()
})

function scheduleNightlyBackup() {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setDate(midnight.getDate() + 1)
  midnight.setHours(0, 0, 0, 0)
  const msUntilMidnight = midnight.getTime() - now.getTime()

  const minutesUntil = Math.round(msUntilMidnight / 1000 / 60)
  console.log(`[Backup Scheduler] Auto backup dijadwalkan dalam ${minutesUntil} menit (jam 00:00)`)

  setTimeout(async () => {
    await runNightlyBackup()
    // Repeat every 24 hours
    setInterval(runNightlyBackup, 24 * 60 * 60 * 1000)
  }, msUntilMidnight)
}

async function runNightlyBackup() {
  console.log('[Backup Scheduler] Menjalankan auto backup database...')
  try {
    const record = await createDatabaseBackup({ type: 'scheduled' })
    console.log(`[Backup Scheduler] Backup selesai: ${record.filename} (${(record.size / 1024).toFixed(1)} KB)`)
  } catch (error) {
    console.error('[Backup Scheduler] Auto backup gagal:', error)
  }
}
