export default defineNuxtRouteMiddleware(() => {
  const token = useCookie('tenant-token')
  
  // If already logged in, redirect to dashboard
  if (token.value) {
    return navigateTo('/tenant-portal')
  }
})
