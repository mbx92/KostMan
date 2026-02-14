import { requireRole, Role } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Only admin can restart server
  requireRole(event, [Role.ADMIN])

  const body = await readBody(event).catch(() => ({}))
  const method = body.method || 'process' // 'process' is safer default

  try {
    // Method: process exit (works with PM2, systemd, nodemon, or any process manager)
    console.log('Initiating graceful server restart...')
    
    // Send response before restart
    setResponseStatus(event, 200)
    
    const response = {
      success: true,
      message: 'Server restart initiated',
      method: 'process',
      note: 'Server will restart in 2 seconds. If using a process manager (PM2, systemd, nodemon), it will auto-restart.'
    }

    // Send the response
    await send(event, JSON.stringify(response))

    // Delay exit to allow response to be sent
    setTimeout(() => {
      console.log('Exiting process for restart...')
      console.log('If using PM2/systemd/nodemon, server will restart automatically')
      process.exit(0)
    }, 2000)

  } catch (error: any) {
    console.error('Server restart error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to restart server'
    })
  }
})
