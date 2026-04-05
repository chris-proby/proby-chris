import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await params

  // Verify caller is super admin
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) return NextResponse.json({ error: 'Service role key 없음' }, { status: 500 })

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get profiles for this company (excluding super admins)
  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, full_name, company_id')
    .eq('company_id', companyId)
    .eq('is_super_admin', false)

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 500 })
  if (!profiles || profiles.length === 0) return NextResponse.json({ users: [] })

  // Fetch auth users to get emails
  const { data: { users: authUsers }, error: authError } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 })

  const emailMap = new Map(authUsers.map((u) => [u.id, u.email ?? '']))

  const users = profiles.map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailMap.get(p.id) ?? '',
  }))

  return NextResponse.json({ users })
}
