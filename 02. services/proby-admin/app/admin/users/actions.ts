'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type CreateUserResult =
  | { success: true; userId: string }
  | { success: false; error: string }

export async function createUserAction(data: {
  email: string
  password: string
  fullName: string
  companyId: string | null
}): Promise<CreateUserResult> {
  // Server action must verify super admin before using service role key
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '인증이 필요합니다' }

  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) return { success: false, error: '권한이 없습니다' }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return { success: false, error: '서버 설정 오류가 발생했습니다' }
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email.trim(),
    password: data.password,
    email_confirm: true,
    user_metadata: { full_name: data.fullName.trim() || null },
  })

  if (authError) return { success: false, error: '유저 생성에 실패했습니다' }
  if (!authData.user) return { success: false, error: '유저 생성에 실패했습니다' }

  const userId = authData.user.id

  const profileUpdate: Record<string, unknown> = {}
  if (data.fullName.trim()) profileUpdate.full_name = data.fullName.trim()
  if (data.companyId) profileUpdate.company_id = data.companyId

  if (Object.keys(profileUpdate).length > 0) {
    await adminClient.from('profiles').update(profileUpdate).eq('id', userId)
  }

  revalidatePath('/admin/users')
  return { success: true, userId }
}
