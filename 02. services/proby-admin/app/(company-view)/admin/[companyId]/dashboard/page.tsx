import { createClient } from '@/lib/supabase/server'
import { Company, DashboardWidget } from '@/lib/types'
import WidgetGrid from '@/components/drive/WidgetGrid'
import { notFound } from 'next/navigation'

export default async function AdminCompanyDashboardPage({
  params,
}: {
  params: Promise<{ companyId: string }>
}) {
  const { companyId } = await params
  const supabase = await createClient()

  const { data: companyData } = await supabase.from('companies').select('*').eq('id', companyId).single()
  if (!companyData) notFound()
  const company = companyData as Company

  const { data: widgetsData } = await supabase
    .from('dashboard_widgets')
    .select('*')
    .eq('company_id', companyId)
    .order('display_order')
  const widgets = (widgetsData ?? []) as DashboardWidget[]

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="mb-6">
        <h1 className="text-white text-xl font-semibold">{company.name}</h1>
        <p className="text-zinc-400 text-sm mt-0.5">대시보드</p>
      </div>
      <WidgetGrid
        widgets={widgets}
        companyId={companyId}
        isSuperAdmin={true}
      />
    </div>
  )
}
