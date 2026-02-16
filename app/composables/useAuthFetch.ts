/**
 * Authenticated useFetch wrapper that properly forwards cookies for iOS compatibility
 * Use this instead of useFetch when calling authenticated API endpoints
 */
export const useAuthFetch = <T>(url: string, options: any = {}) => {
  // Forward cookie headers for SSR to work with HttpOnly cookies on iOS
  const headers = useRequestHeaders(['cookie'])
  
  return useFetch<T>(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  })
}
