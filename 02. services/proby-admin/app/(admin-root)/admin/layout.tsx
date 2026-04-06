import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminLayout from '@/components/admin/AdminLayout'
import { Profile } from '@/lib/types'

export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profileResult = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = profileResult.data as Profile | null
  if (!profile?.is_super_admin) redirect('/drive')

  return <AdminLayout user={user} profile={profile}>{children}</AdminLayout>
}
