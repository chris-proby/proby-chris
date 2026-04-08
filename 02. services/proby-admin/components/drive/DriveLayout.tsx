'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useMixpanelIdentify } from '@/hooks/useMixpanelIdentify'
import { trackMixpanel, resetMixpanel } from '@/lib/analytics/mixpanel'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { User } from '@supabase/supabase-js'
import { Profile, Company } from '@/lib/types'
import { LogOut, ChevronDown, HardDrive, Coins, LayoutDashboard, ArrowLeft, LogIn } from 'lucide-react'
import { hexToRgba } from '@/lib/color-utils'

interface DriveLayoutProps {
  user: User | null
  profile: Profile | null
  company: Company | null
  children: React.ReactNode
  basePath?: string      // default: '/drive'
  isSuperAdmin?: boolean // shows admin back link when true
  isGuest?: boolean      // guest browse mode — no auth, read-only nav
}

export default function DriveLayout({ user, profile, company, children, basePath = '/drive', isSuperAdmin = false, isGuest = false }: DriveLayoutProps) {
  const driveHref = basePath === '/drive' ? '/drive' : `${basePath}/drive`
  const dashboardHref = isGuest ? '/browse' : `${basePath}/dashboard`
  const guestDriveHref = '/browse/drive'
  const NAV_ITEMS = isGuest
    ? [
        { label: '대시보드', href: '/browse', icon: LayoutDashboard, exact: true },
        { label: '드라이브', href: guestDriveHref, icon: HardDrive, exact: false },
      ]
    : [
        { label: '대시보드', href: `${basePath}/dashboard`, icon: LayoutDashboard, exact: false },
        { label: '드라이브', href: driveHref, icon: HardDrive, exact: true },
      ]
  const router = useRouter()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)

  useMixpanelIdentify({
    user,
    profile,
    company,
    shell: 'DriveLayout',
    isAdminCompanyShell: isSuperAdmin,
  })

  useEffect(() => {
    trackMixpanel('DriveLayout_shell_pathname_view', {
      pathname,
      base_path: basePath,
      is_super_admin_shell: isSuperAdmin,
      is_guest: isGuest,
      company_id: company?.id ?? null,
      company_name: company?.name ?? null,
    })
  }, [pathname, basePath, isSuperAdmin, isGuest, company?.id, company?.name])

  const primary = company?.primary_color ?? '#6366f1'
  const secondary = company?.secondary_color ?? '#8b5cf6'
  const companyName = company?.name ?? 'Proby Admin'
  const userInitials = user
    ? (profile?.full_name ?? user.email ?? 'U').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'G'
  const credits = company?.credits ?? 0

  const brandVars = {
    '--brand-primary': primary,
    '--brand-secondary': secondary,
    '--brand-primary-10': hexToRgba(primary, 0.1),
    '--brand-primary-20': hexToRgba(primary, 0.2),
    '--brand-primary-30': hexToRgba(primary, 0.3),
    '--brand-secondary-10': hexToRgba(secondary, 0.1),
  } as React.CSSProperties

  async function handleSignOut() {
    setSigningOut(true)
    trackMixpanel('DriveLayout_User_Signed_Out', {
      company_id: company?.id ?? null,
      company_name: company?.name ?? null,
    })
    await createClient().auth.signOut()
    router.push('/login')
  }

  function isActive(href: string, exact: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex" style={brandVars}>
      {/* 사이드바 */}
      <aside
        className="w-56 shrink-0 flex flex-col border-r"
        style={{ borderColor: hexToRgba(primary, 0.15), background: `linear-gradient(180deg, ${hexToRgba(primary, 0.06)} 0%, transparent 40%)` }}
      >
        {/* 상단 accent line */}
        <div className="h-[2px] shrink-0" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary}, transparent)` }} />

        {/* 어드민 뒤로가기 */}
          {isSuperAdmin && !isGuest && (
          <div className="px-3 pt-3 shrink-0">
            <Link
              href="/admin"
              onClick={() => trackMixpanel('DriveLayout_Back_To_Admin_Clicked', { from_company_id: company?.id, from_company_name: company?.name })}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors text-xs"
            >
              <ArrowLeft className="w-3 h-3" />고객사 목록
            </Link>
          </div>
        )}

        {/* 로고 */}
        <div className="px-4 py-4 shrink-0">
          <Link href={dashboardHref} className="flex items-center gap-2.5 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all group-hover:scale-105 shadow-sm shrink-0"
              style={{ backgroundColor: primary, boxShadow: `0 0 12px ${hexToRgba(primary, 0.4)}` }}
            >
              {company?.logo_url ? (
                <img src={company.logo_url} alt={companyName} className="w-6 h-6 object-contain" />
              ) : (
                <HardDrive className="w-4 h-4 text-white" />
              )}
            </div>
            <span className="text-white font-semibold text-sm tracking-tight truncate">{companyName}</span>
          </Link>
        </div>

        <div className="mx-4 h-px shrink-0" style={{ background: hexToRgba(primary, 0.15) }} />

        {/* 네비게이션 */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
            const active = isActive(href, exact)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => trackMixpanel('DriveLayout_Nav_Clicked', { label, href, company_id: company?.id ?? null })}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'text-zinc-100' : ''}`}
                style={active ? {
                  background: hexToRgba(primary, 0.15),
                  boxShadow: `inset 0 0 0 1px ${hexToRgba(primary, 0.2)}`,
                } : {
                  color: 'rgb(161 161 170)',
                }}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* 하단: 크레딧 + 유저 */}
        <div className="px-3 pb-4 flex flex-col gap-2 shrink-0">
          {/* 크레딧 배지 */}
          {!isGuest && (
            <div
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border"
              style={{
                background: credits > 0 ? hexToRgba(primary, 0.08) : 'rgba(239,68,68,0.06)',
                borderColor: credits > 0 ? hexToRgba(primary, 0.2) : 'rgba(239,68,68,0.2)',
              }}
            >
              <Coins className="w-3.5 h-3.5 shrink-0" style={{ color: credits > 0 ? primary : '#f87171' }} />
              <span className="text-xs font-semibold tabular-nums" style={{ color: credits > 0 ? primary : '#f87171' }}>
                {credits.toLocaleString()}
              </span>
              <span className="text-xs" style={{ color: hexToRgba(credits > 0 ? primary : '#f87171', 0.65) }}>
                크레딧
              </span>
            </div>
          )}

          {/* 게스트: 로그인 버튼 */}
          {isGuest ? (
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 transition-colors text-xs font-medium text-white"
              style={{ backgroundColor: primary }}
            >
              <LogIn className="w-3.5 h-3.5" />
              로그인하기
            </Link>
          ) : (
            /* 유저 드롭다운 */
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5 w-full">
                  <Avatar className="w-7 h-7 shrink-0">
                    <AvatarFallback
                      className="text-xs font-semibold text-white"
                      style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                    >
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-zinc-300 text-xs truncate flex-1 text-left">{profile?.full_name ?? user?.email}</span>
                  <ChevronDown className="w-3 h-3 text-zinc-500 shrink-0" />
                </button>
              } />
              <DropdownMenuContent side="top" align="start" className="w-48 bg-zinc-900 border-zinc-800">
                <div className="px-3 py-2">
                  <p className="text-xs font-medium text-white">{profile?.full_name ?? '사용자'}</p>
                  <p className="text-xs text-zinc-400 truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem onClick={handleSignOut} disabled={signingOut} className="text-red-400 focus:bg-zinc-800 focus:text-red-300 cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />{signingOut ? '로그아웃 중...' : '로그아웃'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">{children}</main>
    </div>
  )
}
