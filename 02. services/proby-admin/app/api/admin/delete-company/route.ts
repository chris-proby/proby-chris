import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function PATCH(req: NextRequest) {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Service key not configured' }, { status: 500 })

  const { companyId, restore } = await req.json()
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false },
  })

  const { error } = await adminClient
    .from('companies')
    .update({ is_archived: !restore })
    .eq('id', companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, archived: !restore })
}
