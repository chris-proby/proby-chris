import { createClient } from '@/lib/supabase/server'
import { Company } from '@/lib/types'
import AdminUserList from '@/components/admin/AdminUserList'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: usersData } = await supabase.rpc('get_all_users')
  const { data: companiesData } = await supabase.from('companies').select('*').eq('is_archived', false).order('name')

  return (
    <AdminUserList
      users={(usersData ?? []) as {
        id: string; email: string; full_name: string | null;
        company_id: string | null; company_name: string | null;
        is_super_admin: boolean; created_at: string
      }[]}
      companies={(companiesData ?? []) as Company[]}
    />
  )
}
