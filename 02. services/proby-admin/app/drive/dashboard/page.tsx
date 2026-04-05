import { createClient } from '@/lib/supabase/server'
import { Company, Profile } from '@/lib/types'
import { HardDrive, Coins, FolderOpen, FileText } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileResult = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const profile = profileResult.data as Profile | null

  let company: Company | null = null
  let folderCount = 0
  let fileCount = 0

  if (profile?.company_id) {
    const { data } = await supabase.from('companies').select('*').eq('id', profile.company_id).single()
    company = data as Company | null

    const { count: fc } = await supabase.from('folders').select('*', { count: 'exact', head: true }).eq('company_id', profile.company_id)
    const { count: dc } = await supabase.from('files').select('*', { count: 'exact', head: true }).eq('company_id', profile.company_id)
    folderCount = fc ?? 0
    fileCount = dc ?? 0
  }

  const primary = company?.primary_color ?? '#6366f1'
  const credits = company?.credits ?? 0
  const companyName = company?.name ?? 'Proby Admin'

  const stats = [
    { label: '잔여 크레딧', value: credits.toLocaleString(), unit: '크레딧', icon: Coins },
    { label: '전체 폴더', value: folderCount.toLocaleString(), unit: '개', icon: FolderOpen },
    { label: '전체 파일', value: fileCount.toLocaleString(), unit: '개', icon: FileText },
  ]

  return (
    <div className="flex-1 p-6 overflow-auto">
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-white text-xl font-semibold">{companyName}</h1>
          <p className="text-zinc-400 text-sm mt-0.5">대시보드</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map(({ label, value, unit, icon: Icon }) => (
            <div
              key={label}
              className="rounded-xl p-4 border border-zinc-800 bg-zinc-900/60 flex flex-col gap-3"
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-zinc-500" />
                <span className="text-zinc-400 text-xs">{label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-white text-2xl font-bold tabular-nums">{value}</span>
                <span className="text-zinc-500 text-sm">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
