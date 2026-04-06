import { createClient } from '@/lib/supabase/server'
import { Company, Profile, DashboardWidget } from '@/lib/types'
import WidgetGrid from '@/components/drive/WidgetGrid'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileResult = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = profileResult.data as Profile | null

  let company: Company | null = null
  let widgets: DashboardWidget[] = []

  if (profile?.company_id) {
    const { data } = await supabase.from('companies').select('*').eq('id', profile.company_id).single()
    company = data as Company | null

    const { data: widgetsData } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('company_id', profile.company_id)
      .order('display_order')
    widgets = (widgetsData ?? []) as DashboardWidget[]
  }

  const companyName = company?.name ?? 'Proby Admin'

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="mb-6">
        <h1 className="text-white text-xl font-semibold">{companyName}</h1>
        <p className="text-zinc-400 text-sm mt-0.5">대시보드</p>
      </div>
      <WidgetGrid
        widgets={widgets}
        companyId={profile?.company_id ?? ''}
        isSuperAdmin={false}
      />
    </div>
  )
}
