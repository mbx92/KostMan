export default defineNuxtRouteMiddleware(async (to) => {
  const token = useCookie('tenant-token')
  
  // If no token, redirect to login
  if (!token.value) {
    return navigateTo('/tenant-portal/login')
  }

  // Verify token and get tenant info
  try {
    const response = await $fetch<{
      success: boolean
      tenant: any
      isDefaultPin: boolean
    }>('/api/tenant-auth/me', {
      headers: {
        Authorization: `Bearer ${token.value}`
      }
    })

    // If using default PIN and not on change-pin page, redirect
    if (response.isDefaultPin && to.path !== '/tenant-portal/change-pin') {
      return navigateTo('/tenant-portal/change-pin')
    }

    // If already changed PIN and trying to access change-pin page, redirect to dashboard
    if (!response.isDefaultPin && to.path === '/tenant-portal/change-pin') {
      return navigateTo('/tenant-portal')
    }
  } catch (e) {
    // Invalid token, clear and redirect to login
    token.value = null
    return navigateTo('/tenant-portal/login')
  }
})
