import { createClient } from '@supabase/supabase-js'
import { Company, Folder, FileRecord } from '@/lib/types'
import DriveLayout from '@/components/drive/DriveLayout'
import DriveView from '@/components/drive/DriveView'
import Link from 'next/link'
import { Eye, LogIn } from 'lucide-react'
import { cookies } from 'next/headers'

const PROBY_SLUG = 'proby'
const DRIVE_BASE = '/browse/drive'

export default async function BrowseDrivePage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>
}) {
  const { folder: folderId } = await searchParams

  // Gate: must have valid consent cookie
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

  if (!company) {
    return (
      <DriveLayout user={null} profile={null} company={null} isGuest>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-zinc-400">드라이브 데이터를 불러올 수 없습니다.</p>
        </div>
      </DriveLayout>
    )
  }

  const foldersQuery = supabase
    .from('folders')
    .select('*')
    .eq('company_id', company.id)
    .order('name')
  const { data: allFoldersData } = folderId
    ? await foldersQuery.eq('parent_id', folderId)
    : await foldersQuery.is('parent_id', null)

  const filesQuery = supabase
    .from('files')
    .select('*')
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })
  const { data: filesData } = folderId
    ? await filesQuery.eq('folder_id', folderId)
    : await filesQuery.is('folder_id', null)

  let breadcrumbs: { id: string; name: string }[] = []
  if (folderId) {
    let currentId: string | null = folderId
    while (currentId) {
      const { data: fd } = await supabase
        .from('folders')
        .select('id, name, parent_id')
        .eq('id', currentId)
        .single()
      if (!fd) break
      const f = fd as { id: string; name: string; parent_id: string | null }
      breadcrumbs.unshift({ id: f.id, name: f.name })
      currentId = f.parent_id
    }
  }

  return (
    <DriveLayout user={null} profile={null} company={company} isGuest>
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
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

        <DriveView
          folders={(allFoldersData ?? []) as Folder[]}
          files={(filesData ?? []) as FileRecord[]}
          breadcrumbs={breadcrumbs}
          currentFolderId={folderId ?? null}
          companyId={company.id}
          primaryColor={company.primary_color ?? '#6366f1'}
          secondaryColor={company.secondary_color ?? '#8b5cf6'}
          isReadOnly
          driveBasePath={DRIVE_BASE}
        />
      </div>
    </DriveLayout>
  )
}
