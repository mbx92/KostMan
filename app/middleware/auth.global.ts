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

    // On server: check cookie directly, if missing redirect immediately
    if (import.meta.server) {
        const token = useCookie('auth_token')
        if (!token.value) {
            return navigateTo('/login')
        }
    }

    // Verify session by calling API
    // Use $fetch (not useFetch) to avoid caching/deduplication issues in middleware
    try {
        const headers: Record<string, string> = {}
        
        // On server-side, forward cookie headers from the original browser request
        if (import.meta.server) {
            const reqHeaders = useRequestHeaders(['cookie'])
            if (reqHeaders.cookie) {
                headers['cookie'] = reqHeaders.cookie
            }
        }

        await $fetch('/api/auth/me', {
            headers,
            credentials: 'include',
        })
    } catch (e: any) {
        return navigateTo('/login')
    }
})
