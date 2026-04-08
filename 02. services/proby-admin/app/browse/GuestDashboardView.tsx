'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Company, DashboardWidget } from '@/lib/types'
import WidgetGrid from '@/components/drive/WidgetGrid'
import { LogIn, Eye } from 'lucide-react'

interface GuestDashboardViewProps {
  company: Company | null
  widgets: DashboardWidget[]
}

export default function GuestDashboardView({ company, widgets }: GuestDashboardViewProps) {
  const companyName = company?.name ?? 'Proby'
  const primary = company?.primary_color ?? '#6366f1'
  const secondary = company?.secondary_color ?? '#8b5cf6'

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="h-14 flex items-center px-5 gap-3">
          {/* 로고 */}
          <Link href="/login" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/proby-icon-white.png"
              alt="Proby"
              width={28}
              height={28}
              className="object-contain"
            />
            <Image
              src="/proby-logo-white.png"
              alt="Proby"
              width={60}
              height={18}
              className="object-contain hidden sm:block"
            />
          </Link>

          {/* 게스트 배지 */}
          <span className="flex items-center gap-1 text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25 px-2 py-0.5 rounded-full">
            <Eye className="w-3 h-3" />
            읽기 전용 미리보기
          </span>

          <div className="flex-1" />

          {/* 로그인 CTA */}
          <Link
            href="/login"
            className="flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" />
            로그인하기
          </Link>
        </div>
      </header>

      {/* 안내 배너 */}
      <div
        className="shrink-0 px-5 py-2.5 flex items-center gap-2 text-xs"
        style={{
          background: `linear-gradient(90deg, rgba(99,102,241,0.08) 0%, transparent 100%)`,
          borderBottom: '1px solid rgba(99,102,241,0.12)',
        }}
      >
        <Eye className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
        <span className="text-zinc-400">
          현재 <strong className="text-indigo-300">읽기 전용 미리보기</strong> 모드입니다.
          파일 업로드, 수정, 삭제 등의 기능은 로그인 후 사용 가능합니다.
        </span>
        <Link href="/login" className="ml-auto text-indigo-400 hover:text-indigo-300 transition-colors font-medium whitespace-nowrap">
          로그인 →
        </Link>
      </div>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-0.5">
            {company?.logo_url && (
              <img
                src={company.logo_url}
                alt={companyName}
                className="w-6 h-6 object-contain rounded"
              />
            )}
            <h1 className="text-white text-xl font-semibold">{companyName}</h1>
          </div>
          <p className="text-zinc-400 text-sm">대시보드</p>
        </div>

        {/* 위젯 그리드 — 읽기 전용 (isSuperAdmin=false) */}
        <WidgetGrid
          widgets={widgets}
          companyId={company?.id ?? ''}
          isSuperAdmin={false}
        />

        {/* 하단 CTA */}
        {widgets.length > 0 && (
          <div
            className="mt-10 rounded-2xl border p-6 flex flex-col sm:flex-row items-center justify-between gap-4"
            style={{
              background: `linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))`,
              borderColor: 'rgba(99,102,241,0.2)',
            }}
          >
            <div>
              <p className="text-white font-semibold text-sm">전체 기능을 사용하려면 로그인하세요</p>
              <p className="text-zinc-400 text-xs mt-0.5">파일 관리, 드라이브, 협업 기능 등을 이용할 수 있습니다</p>
            </div>
            <Link
              href="/login"
              className="shrink-0 flex items-center gap-1.5 h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              <LogIn className="w-4 h-4" />
              로그인 / 계정 신청
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
