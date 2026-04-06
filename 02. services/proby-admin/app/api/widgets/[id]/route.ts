import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getSuperAdminClient() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  return profile?.is_super_admin ? supabase : null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSuperAdminClient()
  if (!supabase) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  const body = await request.json()
  const { title, description, thumbnail_url, redirect_url, tags } = body

  const { data, error } = await supabase
    .from('dashboard_widgets')
    .update({ title, description: description || null, thumbnail_url: thumbnail_url || null, redirect_url, tags: tags ?? [], updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await getSuperAdminClient()
  if (!supabase) return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 })

  const { error } = await supabase.from('dashboard_widgets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
