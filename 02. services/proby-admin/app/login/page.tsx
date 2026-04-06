'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { toast.error('로그인 실패', { description: error.message }); setLoading(false); return }
    router.push('/drive/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 mb-5">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="10" stroke="white" strokeWidth="2.5"/><circle cx="14" cy="14" r="4" fill="white"/></svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Proby Admin</h1>
          <p className="text-zinc-400 text-sm mt-1">인터뷰 결과물 전달 플랫폼</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-300 text-sm font-medium">이메일</Label>
              <Input id="email" type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500 h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300 text-sm font-medium">비밀번호</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500 h-11" />
            </div>
            <Button type="submit" disabled={loading} className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl">
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </div>
        <p className="text-center text-zinc-600 text-xs mt-6">계정이 없으신가요? Proby 팀에 문의해주세요</p>
      </div>
    </div>
  )
}
