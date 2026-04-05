import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  // Verify caller is a super admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다' }, { status: 500 })
  }

  const { email, password, fullName, companyId } = await req.json()
  if (!email || !password) return NextResponse.json({ error: '이메일과 비밀번호는 필수입니다' }, { status: 400 })

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName?.trim() || null },
  })

  if (authError) return NextResponse.json({ error: '유저 생성에 실패했습니다' }, { status: 400 })
  if (!authData.user) return NextResponse.json({ error: '유저 생성 실패' }, { status: 500 })

  const profileUpdate: Record<string, unknown> = {}
  if (fullName?.trim()) profileUpdate.full_name = fullName.trim()
  if (companyId) profileUpdate.company_id = companyId

  if (Object.keys(profileUpdate).length > 0) {
    await adminClient.from('profiles').update(profileUpdate).eq('id', authData.user.id)
  }

  return NextResponse.json({ success: true, userId: authData.user.id })
}
