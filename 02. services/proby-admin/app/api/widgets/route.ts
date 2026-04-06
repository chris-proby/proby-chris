import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getSuperAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  return profile?.is_super_admin ? supabase : null
}

export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get('company_id')
  if (!companyId) return NextResponse.json({ error: 'company_id required' }, { status: 400 })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('dashboard_widgets')
    .select('*')
    .eq('company_id', companyId)
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await getSuperAdmin()
  if (!supabase) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  const body = await request.json()
  const { company_id, title, description, thumbnail_url, redirect_url, tags, display_order } = body
  if (!company_id || !title || !redirect_url) {
    return NextResponse.json({ error: '필수 항목이 누락됐습니다' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('dashboard_widgets')
    .insert({ company_id, title, description: description || null, thumbnail_url: thumbnail_url || null, redirect_url, tags: tags ?? [], display_order: display_order ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
