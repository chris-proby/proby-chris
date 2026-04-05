import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Database } from '../types'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet, _headers) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            /* Server Component에서는 쿠키/헤더 설정이 막힐 수 있음 — 프록시가 세션 갱신 담당 */
          }
        },
      },
    }
  )
}
