import { requireRole, Role } from '../../utils/permissions'

export default defineEventHandler(async (event) => {
  // Only admin can restart server
  requireRole(event, [Role.ADMIN])

  try {
    // Try to read body, but don't fail if it's missing
    let body: any = {}
    try {
      body = await readBody(event)
    } catch (e) {
      // Body is optional
    }
    
    const method = body?.method || 'process' // 'process' is safer default
    const isWindowsDev = process.platform === 'win32' && process.env.NODE_ENV === 'development'

    // On Windows dev mode, don't actually restart - just return message
    if (isWindowsDev) {
      console.log('[Restart] Windows development mode detected - skipping auto-restart')
      return {
        success: false,
        cannotRestart: true,
        message: 'Auto-restart not supported on Windows in development mode',
        platform: process.platform,
        env: process.env.NODE_ENV,
        note: 'Please manually restart the server by stopping (Ctrl+C) and running: npm run dev'
      }
    }

    // Method: process exit (works with PM2, systemd, nodemon, or any process manager)
    console.log('Initiating graceful server restart...')
    
    // Send response before restart
    setResponseStatus(event, 200)
    
    const response = {
      success: true,
      message: 'Server restart initiated',
      method: 'process',
      note: 'Server will restart in 2 seconds. If using a process manager (PM2, systemd, nodemon), it will auto-restart.',
      platform: process.platform,
      env: process.env.NODE_ENV
    }

    // Send the response
    await send(event, JSON.stringify(response))

    // Delay exit to allow response to be sent
    setTimeout(() => {
      console.log('Exiting process for restart...')
      console.log('Platform:', process.platform)
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
