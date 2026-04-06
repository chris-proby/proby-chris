import { createClient } from '@/lib/supabase/server'
import { Company } from '@/lib/types'
import AdminCompanyList from '@/components/admin/AdminCompanyList'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: companiesData } = await supabase.from('companies').select('*').order('name')
  const companies = companiesData as Company[] ?? []

  const { data: fileData } = await supabase.from('files').select('company_id')
  const fileCounts: Record<string, number> = {}
  ;(fileData ?? []).forEach((f: { company_id: string }) => { fileCounts[f.company_id] = (fileCounts[f.company_id] ?? 0) + 1 })

  return <AdminCompanyList companies={companies} fileCounts={fileCounts} />
}
