export default defineNuxtRouteMiddleware(async (to) => {
    // Add '/my-profile' and '/account' to public paths if needed, or handle them in restricted
    const publicPaths = ['/login', '/register', '/tenant-portal/login']

    if (publicPaths.includes(to.path)) {
        return
    }

    // Allow tenant portal paths to be handled by tenant-auth middleware
    if (to.path.startsWith('/tenant-portal')) {
        return
    }

    // Check for auth token (Server-side only optimization)
    // On client, cookie is HttpOnly and invisible to JS, so we must verify via API
    const token = useCookie('auth_token')
    if (import.meta.server && !token.value) {
        return navigateTo('/login')
    }

    // Fetch user to verify session and role (optional but safer)
    // We use useFetch with headers to ensure cookies are passed on SSR
    try {
        const { data, error } = await useFetch('/api/auth/me', {
            headers: useRequestHeaders(['cookie']) as any
        })

        if (error.value || !data.value) {
            // Token invalid or expired
            return navigateTo('/login')
        }
    } catch (e) {
        return navigateTo('/login')
    }
})
