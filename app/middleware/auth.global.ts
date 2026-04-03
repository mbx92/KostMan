export default defineNuxtRouteMiddleware(async (to) => {
    const publicPaths = ['/login', '/register', '/tenant-portal/login']
    
    // Allow public paths
    if (publicPaths.includes(to.path)) {
        return
    }

    // Allow tenant portal paths to be handled by tenant-auth middleware
    if (to.path.startsWith('/tenant-portal')) {
        return
    }

    // Allow invoice public paths
    if (to.path.startsWith('/invoice/')) {
        return
    }

    // On server: auth cookie is HttpOnly, so rely on the request context populated
    // by Nitro server middleware instead of trying to read the cookie in app code.
    if (import.meta.server) {
        const event = useRequestEvent()

        if (!event?.context.user) {
            return navigateTo('/login')
        }

        return
    }

    // On client: verify the active session via an authenticated request.
    try {
        await $fetch('/api/auth/me', {
            credentials: 'include',
        })
    } catch (e: any) {
        try {
            await $fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            })
        } catch {
            // Ignore cleanup failures and continue redirecting to login.
        }

        return navigateTo('/login')
    }
})

