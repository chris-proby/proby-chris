import { NextRequest, NextResponse } from 'next/server'

const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'naver.com', 'hanmail.net', 'daum.net', 'kakao.com',
  'yahoo.com', 'yahoo.co.kr', 'yahoo.co.jp',
  'hotmail.com', 'hotmail.co.kr', 'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'nate.com', 'paran.com', 'empal.com', 'lycos.co.kr',
  'qq.com', '163.com', '126.com', 'sina.com',
  'protonmail.com', 'proton.me', 'tutanota.com', 'mail.com',
])

export async function POST(req: NextRequest) {
  const { email } = await req.json()

  // 이메일은 필수 (쿠키 게이트의 목적은 회사 도메인 확인, 마케팅 동의와 무관)
  if (!email) {
    return NextResponse.json({ error: '이메일이 필요합니다' }, { status: 400 })
  }

  const domain = (email as string).split('@')[1]?.toLowerCase()
  if (!domain) {
    return NextResponse.json({ error: '유효한 이메일이 아닙니다' }, { status: 400 })
  }
  if (PERSONAL_DOMAINS.has(domain)) {
    return NextResponse.json({ error: '회사 도메인 이메일만 사용 가능합니다' }, { status: 400 })
  }

  const res = NextResponse.json({ success: true })
  // HttpOnly cookie — 30 minutes guest browse session
  // 마케팅 동의 여부와 무관하게 회사 이메일 확인 시 발급
  res.cookies.set('guest_browse_consent', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 30,
    path: '/browse',
  })
  return res
}
