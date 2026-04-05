import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DriveLayout from '@/components/drive/DriveLayout'
import { Company, Profile } from '@/lib/types'

export default async function DriveRootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profileResult = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = profileResult.data as Profile | null

  let company: Company | null = null
  if (profile?.company_id) {
    const r = await supabase.from('companies').select('*').eq('id', profile.company_id).single()
    company = r.data as Company | null
  }

  return (
    <DriveLayout user={user} profile={profile} company={company}>
      {children}
    </DriveLayout>
  )
}
