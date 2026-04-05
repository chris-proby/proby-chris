'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { User } from '@supabase/supabase-js'
import { Profile } from '@/lib/types'
import { LogOut, ChevronDown, Shield, Building2, Users } from 'lucide-react'

export default function AdminLayout({ user, profile, children }: { user: User; profile: Profile | null; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [signingOut, setSigningOut] = useState(false)
  const userInitials = (profile?.full_name ?? user.email ?? 'A').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)

  async function handleSignOut() {
    setSigningOut(true)
    await createClient().auth.signOut()
    router.push('/login')
  }

  const tabs = [
    { href: '/admin', label: '고객사', icon: Building2, exact: true },
    { href: '/admin/users', label: '유저 관리', icon: Users, exact: false },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900 shrink-0">
        <div className="h-14 flex items-center px-4 gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-semibold text-sm tracking-tight">Proby Admin</span>
            <span className="text-[10px] font-semibold bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded-md">SUPER ADMIN</span>
          </div>
          <div className="flex-1" />
          <DropdownMenu>
            <DropdownMenuTrigger render={
              <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-zinc-800 transition-colors">
                <Avatar className="w-7 h-7"><AvatarFallback className="text-xs font-semibold bg-indigo-600 text-white">{userInitials}</AvatarFallback></Avatar>
                <span className="text-zinc-300 text-sm hidden sm:block">{profile?.full_name ?? user.email}</span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            } />
            <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-zinc-800">
              <div className="px-3 py-2"><p className="text-xs text-zinc-400 truncate">{user.email}</p></div>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem onClick={handleSignOut} disabled={signingOut} className="text-red-400 focus:bg-zinc-800 focus:text-red-300 cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />{signingOut ? '로그아웃 중...' : '로그아웃'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex px-4 gap-1">
          {tabs.map((tab) => {
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
            return (
              <Link key={tab.href} href={tab.href} className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${isActive ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                <tab.icon className="w-3.5 h-3.5" />{tab.label}
              </Link>
            )
          })}
        </div>
      </header>
      <main className="flex-1 flex flex-col overflow-hidden">{children}</main>
    </div>
  )
}
