/**
 * Authenticated useFetch wrapper that properly forwards cookies
 * Handles both SSR and client-side, works on iOS Safari
 */

let _keyCounter = 0

export const useAuthFetch = <T>(url: string | (() => string), options: any = {}) => {
  // Generate unique key to prevent cache collisions between components
  const key = options.key || `auth-fetch-${typeof url === 'string' ? url : 'dynamic'}-${++_keyCounter}`
  
  // On server-side: forward cookie headers for SSR to work with HttpOnly cookies
  // On client-side: browser automatically sends HttpOnly cookies via credentials: 'include'
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : {}
  
  return useFetch<T>(url, {
    ...options,
    key,
    credentials: 'include',
    headers: {
      ...headers,
      ...options.headers,
    },
  })
}
