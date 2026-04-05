import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return NextResponse.json({ error: '서버 설정 오류가 발생했습니다' }, { status: 500 })

  const { userId, email, fullName, companyId, newPassword } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId가 필요합니다' }, { status: 400 })

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Update auth user (email / password)
  const authUpdate: { email?: string; password?: string } = {}
  if (email?.trim()) authUpdate.email = email.trim()
  if (newPassword) authUpdate.password = newPassword

  if (Object.keys(authUpdate).length > 0) {
    const { error: authError } = await adminClient.auth.admin.updateUserById(userId, authUpdate)
    if (authError) return NextResponse.json({ error: '유저 정보 업데이트에 실패했습니다' }, { status: 400 })
  }

  // Update profile (full_name / company_id)
  const profileUpdate: Record<string, unknown> = {}
  if (fullName !== undefined) profileUpdate.full_name = fullName?.trim() || null
  if (companyId !== undefined) profileUpdate.company_id = companyId || null

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileError } = await adminClient.from('profiles').update(profileUpdate).eq('id', userId)
    if (profileError) return NextResponse.json({ error: '프로필 업데이트에 실패했습니다' }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
