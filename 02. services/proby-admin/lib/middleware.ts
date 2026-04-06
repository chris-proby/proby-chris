import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { Database } from './types'

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const isLoginPage = request.nextUrl.pathname.startsWith('/login')
  const isBrowsePage = request.nextUrl.pathname.startsWith('/browse')
  const isPrivacyPage = request.nextUrl.pathname.startsWith('/privacy')
  const isAdminRoute = request.nextUrl.pathname.startsWith('/admin')
  const isDriveRoute = request.nextUrl.pathname.startsWith('/drive')
  const isPublicPage = isLoginPage || isBrowsePage || isPrivacyPage

  if (!supabaseUrl || !supabaseAnon) {
    if (isPublicPage) return NextResponse.next()
    const u = request.nextUrl.clone()
    u.pathname = '/login'
    u.search = ''
    return NextResponse.redirect(u)
  }

  let res = NextResponse.next()

  try {
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          res = NextResponse.next()
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options)
          })
          Object.entries(headers ?? {}).forEach(([key, value]) => {
            res.headers.set(key, value)
          })
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user && !isPublicPage) {
      const u = request.nextUrl.clone()
      u.pathname = '/login'
      u.search = ''
      return NextResponse.redirect(u)
    }

    if (user && isLoginPage) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()
      const isSuperAdmin = !!(profile as { is_super_admin: boolean } | null)?.is_super_admin
      const u = request.nextUrl.clone()
      u.pathname = isSuperAdmin ? '/admin' : '/drive'
      return NextResponse.redirect(u)
    }

    if (user && isDriveRoute) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()
      if ((profile as { is_super_admin: boolean } | null)?.is_super_admin) {
        const u = request.nextUrl.clone()
        u.pathname = '/admin'
        return NextResponse.redirect(u)
      }
    }

    if (user && isAdminRoute) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_super_admin')
        .eq('id', user.id)
        .single()
      if (!(profile as { is_super_admin: boolean } | null)?.is_super_admin) {
        const u = request.nextUrl.clone()
        u.pathname = '/drive'
        return NextResponse.redirect(u)
      }
    }

    return res
  } catch (err) {
    console.error('[proby-admin proxy]', err)
    if (isLoginPage) return NextResponse.next()
    if (isBrowsePage) return NextResponse.next()
    const u = request.nextUrl.clone()
    u.pathname = '/login'
    u.search = ''
    return NextResponse.redirect(u)
  }
}
