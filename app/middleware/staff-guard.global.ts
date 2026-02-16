/**
 * Staff Guard Middleware
 * 
 * Restricts staff role to only access allowed pages:
 * - Dashboard (/)
 * - Meter Readings (/meter-readings)
 * - Login (/login)
 * 
 * Redirects to dashboard if staff tries to access other pages.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip middleware on server side during SSR
  if (import.meta.server) return

  // Skip for login page
  if (to.path === '/login') return

  try {
    // Fetch current user using $fetch to avoid caching issues in middleware
    const response = await $fetch<{ user: any }>('/api/auth/me', {
      credentials: 'include',
    })
    const user = response?.user

    // If no user, let auth middleware handle it
    if (!user) return

    // Check if user is staff
    if (user.role === 'staff') {
      // Allowed paths for staff
      const allowedPaths = ['/', '/meter-readings', '/account', '/my-profile']

      // Check if current path is allowed
      const isAllowed = allowedPaths.some(path =>
        to.path === path || to.path.startsWith(path + '/')
      )

      // Redirect to dashboard if not allowed
      if (!isAllowed) {
        return navigateTo('/')
      }
    }
  } catch (error) {
    // If error fetching user, let other middleware handle it
    console.error('Staff guard error:', error)
  }
})
