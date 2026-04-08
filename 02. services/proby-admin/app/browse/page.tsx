import { createClient } from '@supabase/supabase-js'
import { Company, DashboardWidget } from '@/lib/types'
import DriveLayout from '@/components/drive/DriveLayout'
import WidgetGrid from '@/components/drive/WidgetGrid'
import Link from 'next/link'
import { LogIn, Eye } from 'lucide-react'
import { cookies } from 'next/headers'

const PROBY_SLUG = 'proby'

export default async function BrowsePage() {
  // Gate: must have valid consent cookie set by /api/guest-consent
  const cookieStore = await cookies()
  const guestConsented = cookieStore.get('guest_browse_consent')?.value === '1'

  if (!guestConsented) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <p className="text-white font-semibold text-base">둘러보기를 시작하려면</p>
          <p className="text-zinc-400 text-sm">로그인 화면에서 회사 이메일과 마케팅 동의 후 접근해 주세요.</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
          >
            <LogIn className="w-4 h-4" />
            로그인 / 둘러보기로 이동
          </Link>
        </div>
      </div>
    )
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: companyData } = await supabase
    .from('companies')
    .select('*')
    .eq('slug', PROBY_SLUG)
    .single()

  const company = companyData as Company | null

  let widgets: DashboardWidget[] = []
  if (company) {
    const { data: widgetsData } = await supabase
      .from('dashboard_widgets')
      .select('*')
      .eq('company_id', company.id)
      .order('display_order')
    widgets = (widgetsData ?? []) as DashboardWidget[]
  }

  const companyName = company?.name ?? 'Proby'

  return (
    <DriveLayout user={null} profile={null} company={company} isGuest>
      <div className="flex-1 flex flex-col overflow-auto">
        {/* 읽기 전용 안내 배너 */}
        <div
          className="shrink-0 px-6 py-2.5 flex items-center gap-2 text-xs"
          style={{
            background: 'linear-gradient(90deg, rgba(99,102,241,0.08) 0%, transparent 100%)',
            borderBottom: '1px solid rgba(99,102,241,0.12)',
          }}
        >
          <Eye className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-zinc-400">
            현재 <strong className="text-indigo-300">읽기 전용 미리보기</strong> 모드입니다.
            파일 업로드·수정·삭제 등의 기능은 로그인 후 사용 가능합니다.
          </span>
          <Link href="/login" className="ml-auto text-indigo-400 hover:text-indigo-300 transition-colors font-medium whitespace-nowrap">
            로그인 →
          </Link>
        </div>

        {/* 대시보드 본문 */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-0.5">
              {company?.logo_url && (
                <img src={company.logo_url} alt={companyName} className="w-6 h-6 object-contain rounded" />
              )}
              <h1 className="text-white text-xl font-semibold">{companyName}</h1>
            </div>
            <p className="text-zinc-400 text-sm">대시보드</p>
          </div>

          <WidgetGrid widgets={widgets} companyId={company?.id ?? ''} isSuperAdmin={false} />
        </div>
      </div>
    </DriveLayout>
  )
}
