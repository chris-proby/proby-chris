import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DriveLayout from '@/components/drive/DriveLayout'
import { Company, Profile } from '@/lib/types'

export default async function CompanyViewLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profileResult = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = profileResult.data as Profile | null
  if (!profile?.is_super_admin) redirect('/drive')

  const { data: companyData } = await supabase.from('companies').select('*').eq('id', companyId).single()
  if (!companyData) redirect('/admin')
  const company = companyData as Company

  return (
    <DriveLayout
      user={user}
      profile={profile}
      company={company}
      basePath={`/admin/${companyId}`}
      isSuperAdmin={true}
    >
      {children}
    </DriveLayout>
  )
}
