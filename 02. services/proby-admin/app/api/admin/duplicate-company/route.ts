import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })

  const { companyId } = await req.json()
  if (!companyId) return NextResponse.json({ error: 'companyId가 필요합니다' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  })

  // 1. 원본 회사 조회
  const { data: original, error: fetchErr } = await admin
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single()

  if (fetchErr || !original) {
    return NextResponse.json({ error: '원본 고객사를 찾을 수 없습니다' }, { status: 404 })
  }

  // 2. 슬러그 유니크하게 생성 (copy-of-slug → copy-of-slug-2 → ...)
  let newSlug = `copy-of-${original.slug}`
  let suffix = 1
  while (true) {
    const { data: existing } = await admin.from('companies').select('id').eq('slug', newSlug).maybeSingle()
    if (!existing) break
    suffix++
    newSlug = `copy-of-${original.slug}-${suffix}`
  }

  // 3. 새 회사 생성 (파일 제외, 위젯만 복제)
  const { data: newCompany, error: insertErr } = await admin
    .from('companies')
    .insert({
      name: `${original.name} (복사본)`,
      slug: newSlug,
      logo_url: original.logo_url,
      primary_color: original.primary_color,
      secondary_color: original.secondary_color,
      credits: 0,
      is_archived: false,
    })
    .select()
    .single()

  if (insertErr || !newCompany) {
    return NextResponse.json({ error: insertErr?.message ?? '고객사 복제 실패' }, { status: 500 })
  }

  // 4. 대시보드 위젯 복제
  const { data: widgets } = await admin
    .from('dashboard_widgets')
    .select('*')
    .eq('company_id', companyId)
    .order('display_order')

  if (widgets && widgets.length > 0) {
    const newWidgets = widgets.map(({ id: _id, created_at: _ca, updated_at: _ua, company_id: _cid, ...rest }: {
      id: string; created_at: string; updated_at: string; company_id: string;
      title: string; description: string | null; thumbnail_url: string | null;
      redirect_url: string; tags: string[]; display_order: number
    }) => ({ ...rest, company_id: newCompany.id }))
    await admin.from('dashboard_widgets').insert(newWidgets)
  }

  return NextResponse.json({ success: true, company: newCompany })
}
