/**
 * Authenticated useFetch wrapper that properly forwards cookies for iOS compatibility
 * Use this instead of useFetch when calling authenticated API endpoints
 */
export const useAuthFetch = <T>(url: string, options: any = {}) => {
  // On server-side: forward cookie headers for SSR to work with HttpOnly cookies
  // On client-side: browser automatically sends HttpOnly cookies
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : {}
  
  return useFetch<T>(url, {
    ...options,
    credentials: 'include', // Ensure cookies are included in requests
    headers: {
      ...headers,
      ...options.headers,
    },
  })
}
