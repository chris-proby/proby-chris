'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { trackMixpanel, identifyMixpanel } from '@/lib/analytics/mixpanel'
import Image from 'next/image'
import Link from 'next/link'

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'naver.com', 'hanmail.net', 'daum.net', 'kakao.com',
  'yahoo.com', 'yahoo.co.kr', 'yahoo.co.jp',
  'hotmail.com', 'hotmail.co.kr', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'nate.com', 'paran.com', 'empal.com', 'lycos.co.kr',
  'qq.com', '163.com', '126.com', 'sina.com',
  'protonmail.com', 'proton.me',
  'tutanota.com', 'mail.com',
])

function isPersonalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return PERSONAL_DOMAINS.has(domain)
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const [guestEmail, setGuestEmail] = useState('')
  const [guestConsent, setGuestConsent] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [guestEmailError, setGuestEmailError] = useState('')

  function handleGuestEmailChange(value: string) {
    setGuestEmail(value)
    if (value && value.includes('@') && isPersonalEmail(value)) {
      setGuestEmailError('개인 이메일은 사용할 수 없습니다. 회사 도메인 이메일을 입력해주세요.')
    } else {
      setGuestEmailError('')
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    trackMixpanel('Login Attempted', { email })
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      trackMixpanel('Login Failed', { email, error_message: error.message })
      toast.error('로그인 실패', { description: error.message })
      setLoading(false)
      return
    }
    if (data.user) {
      identifyMixpanel(data.user.email ?? data.user.id, { $email: data.user.email })
      trackMixpanel('Login Succeeded', { email, user_id: data.user.id })
    }
    router.push('/drive/dashboard')
    router.refresh()
  }

  async function handleGuestBrowse(e: React.FormEvent) {
    e.preventDefault()
    if (!guestEmail || !guestConsent) return
    if (isPersonalEmail(guestEmail)) {
      setGuestEmailError('개인 이메일은 사용할 수 없습니다. 회사 도메인 이메일을 입력해주세요.')
      return
    }
    setGuestLoading(true)
    // 서버에서 회사 도메인 재검증 + HttpOnly 쿠키 발급 (마케팅 동의와 무관)
    const res = await fetch('/api/guest-consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: guestEmail }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setGuestEmailError((body as { error?: string }).error ?? '오류가 발생했습니다.')
      setGuestLoading(false)
      return
    }
    if (guestConsent) {
      // 동의한 경우에만 이메일을 Mixpanel distinct ID로 연결
      identifyMixpanel(guestEmail, { $email: guestEmail, is_guest: true, marketing_consent: true })
      trackMixpanel('Guest_Browse_Started', { email: guestEmail, marketing_consent: true })
    } else {
      // 미동의 시 이메일 미노출 — 익명 세션으로만 추적
      trackMixpanel('Guest_Browse_Started', { marketing_consent: false })
    }
    router.push('/browse')
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">

        {/* 로고 */}
        <div className="text-center mb-10">
          <Image
            src="/proby-logo-white.png"
            alt="Proby"
            width={110}
            height={30}
            className="object-contain mx-auto mb-2"
          />
          <p className="text-zinc-400 text-sm mt-1">Market intelligence, reoptimized.</p>
        </div>

        {/* 좌우 레이아웃 */}
        <div className="flex flex-col md:flex-row gap-0 md:gap-0 rounded-2xl overflow-hidden border border-zinc-800">

          {/* 왼쪽 — 로그인 */}
          <div className="flex-1 bg-zinc-900 p-8">
            <h2 className="text-white font-semibold text-base mb-6">로그인</h2>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300 text-sm font-medium">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-zinc-300 text-sm font-medium">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500 h-11"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl">
                {loading ? '로그인 중...' : '로그인'}
              </Button>
            </form>
            <p className="text-zinc-600 text-xs mt-6">계정이 없으신가요? Proby 팀에 문의해주세요</p>
            <p className="text-zinc-700 text-xs mt-3">
              <Link href="/privacy" className="hover:text-zinc-500 transition-colors underline underline-offset-2">
                개인정보처리방침
              </Link>
            </p>
          </div>

          {/* 세로 구분선 */}
          <div className="hidden md:flex items-stretch">
            <div className="w-px bg-zinc-800" />
          </div>
          {/* 모바일 가로 구분선 */}
          <div className="md:hidden flex items-center gap-3 px-8 py-4 bg-zinc-900">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-zinc-600 text-xs font-medium">또는</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* 오른쪽 — 둘러보기 */}
          <div className="flex-1 bg-zinc-900/60 p-8">
            <div className="mb-6">
              <h2 className="text-white font-semibold text-base">단순 둘러보기</h2>
              <p className="text-zinc-500 text-xs mt-1">로그인 없이 Proby 대시보드를 미리 확인해보세요</p>
            </div>
            <form onSubmit={handleGuestBrowse} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guest-email" className="text-zinc-400 text-sm font-medium">회사 이메일</Label>
                <Input
                  id="guest-email"
                  type="email"
                  placeholder="name@company.com"
                  value={guestEmail}
                  onChange={(e) => handleGuestEmailChange(e.target.value)}
                  required
                  className={`bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-indigo-500 h-11 ${guestEmailError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {guestEmailError && (
                  <p className="text-red-400 text-xs">{guestEmailError}</p>
                )}
                {!guestEmailError && guestEmail && guestEmail.includes('@') && (
                  <p className="text-zinc-500 text-xs">회사 도메인 이메일만 사용 가능합니다</p>
                )}
              </div>

              {/* 마케팅 동의 */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    checked={guestConsent}
                    onChange={(e) => setGuestConsent(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      guestConsent
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'bg-zinc-800 border-zinc-600 group-hover:border-zinc-500'
                    }`}
                  >
                    {guestConsent && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-zinc-500 text-xs leading-relaxed">
                  입력한 이메일이 Proby의 마케팅 및 서비스 안내 목적으로 활용될 수 있음에 동의합니다.{' '}
                  <span className="text-zinc-600">(선택)</span>
                </span>
              </label>

              <Button
                type="submit"
                disabled={guestLoading || !guestEmail || !!guestEmailError}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
              >
                {guestLoading ? '이동 중...' : '대시보드 둘러보기 →'}
              </Button>
            </form>
          </div>
        </div>

      </div>
    </div>
  )
}
