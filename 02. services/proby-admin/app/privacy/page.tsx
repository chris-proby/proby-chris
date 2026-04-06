import Link from 'next/link'

export const metadata = {
  title: '개인정보처리방침 | Proby',
  description: 'Proby 개인정보처리방침',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 py-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <Link href="/login" className="text-zinc-500 text-sm hover:text-zinc-300 transition-colors">
            ← 로그인으로 돌아가기
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">개인정보처리방침</h1>
        <p className="text-zinc-500 text-sm mb-10">최종 수정일: 2026년 4월 6일</p>

        <div className="space-y-10 text-sm leading-relaxed">

          <section>
            <h2 className="text-white font-semibold text-base mb-3">1. 개인정보 수집 항목 및 수집 방법</h2>
            <p className="mb-3 text-zinc-400">주식회사 포뮬라엑스(이하 "회사")는 Proby 서비스 운영을 위해 아래와 같이 개인정보를 수집합니다.</p>
            <table className="w-full border border-zinc-800 text-xs">
              <thead>
                <tr className="bg-zinc-900">
                  <th className="border border-zinc-800 px-3 py-2 text-left text-zinc-400">구분</th>
                  <th className="border border-zinc-800 px-3 py-2 text-left text-zinc-400">수집 항목</th>
                  <th className="border border-zinc-800 px-3 py-2 text-left text-zinc-400">수집 방법</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-zinc-800 px-3 py-2">서비스 이용 (필수)</td>
                  <td className="border border-zinc-800 px-3 py-2">이메일 주소, 비밀번호(암호화 저장), 성명</td>
                  <td className="border border-zinc-800 px-3 py-2">계정 생성 시 직접 입력</td>
                </tr>
                <tr>
                  <td className="border border-zinc-800 px-3 py-2">대시보드 둘러보기 (선택)</td>
                  <td className="border border-zinc-800 px-3 py-2">회사 이메일 주소</td>
                  <td className="border border-zinc-800 px-3 py-2">둘러보기 폼 직접 입력</td>
                </tr>
                <tr>
                  <td className="border border-zinc-800 px-3 py-2">서비스 이용 기록</td>
                  <td className="border border-zinc-800 px-3 py-2">접속 일시, 서비스 이용 기록</td>
                  <td className="border border-zinc-800 px-3 py-2">서비스 이용 과정에서 자동 수집</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">2. 개인정보 수집 및 이용 목적</h2>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>회원 인증 및 서비스 접근 관리</li>
              <li>인터뷰 결과물 전달 서비스 제공</li>
              <li>서비스 운영 및 개선</li>
              <li>마케팅 및 서비스 안내 (별도 동의 시에 한함)</li>
              <li>고객 문의 응대</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">3. 개인정보 보유 및 이용 기간</h2>
            <p className="text-zinc-400 mb-3">
              회원 탈퇴 또는 서비스 계약 종료 시까지 보유하며, 이후 즉시 파기합니다.
              단, 관계 법령에 따라 보존 의무가 있는 경우 해당 기간 동안 보관합니다.
            </p>
            <table className="w-full border border-zinc-800 text-xs">
              <thead>
                <tr className="bg-zinc-900">
                  <th className="border border-zinc-800 px-3 py-2 text-left text-zinc-400">근거 법령</th>
                  <th className="border border-zinc-800 px-3 py-2 text-left text-zinc-400">보존 항목</th>
                  <th className="border border-zinc-800 px-3 py-2 text-left text-zinc-400">보존 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-zinc-800 px-3 py-2">전자상거래법</td>
                  <td className="border border-zinc-800 px-3 py-2">계약·청약 철회 기록</td>
                  <td className="border border-zinc-800 px-3 py-2">5년</td>
                </tr>
                <tr>
                  <td className="border border-zinc-800 px-3 py-2">통신비밀보호법</td>
                  <td className="border border-zinc-800 px-3 py-2">접속 로그</td>
                  <td className="border border-zinc-800 px-3 py-2">3개월</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">4. 개인정보의 제3자 제공</h2>
            <p className="text-zinc-400">
              회사는 정보주체의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.
              단, 법령에 의해 요구되는 경우는 예외로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">5. 개인정보 처리 위탁 및 국외 이전</h2>
            <p className="mb-3 text-zinc-400">
              회사는 서비스 운영을 위해 아래 업체에 개인정보 처리를 위탁합니다.
              위탁 업체는 미국 소재 서버를 이용하며, 이에 따라 개인정보가 국외로 이전될 수 있습니다.
            </p>
            <table className="w-full border border-zinc-800 text-xs">
              <thead>
                <tr className="bg-zinc-900">
                  <th className="border border-zinc-800 px-3 py-2 text-left text-zinc-400">수탁업체</th>
                  <th className="border border-zinc-800 px-3 py-2 text-left text-zinc-400">위탁 업무</th>
                  <th className="border border-zinc-800 px-3 py-2 text-left text-zinc-400">이전 국가</th>
                  <th className="border border-zinc-800 px-3 py-2 text-left text-zinc-400">보유 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-zinc-800 px-3 py-2">Supabase, Inc.</td>
                  <td className="border border-zinc-800 px-3 py-2">인증, 데이터베이스, 파일 저장</td>
                  <td className="border border-zinc-800 px-3 py-2">미국 (AWS)</td>
                  <td className="border border-zinc-800 px-3 py-2">서비스 계약 기간</td>
                </tr>
                <tr>
                  <td className="border border-zinc-800 px-3 py-2">Vercel, Inc.</td>
                  <td className="border border-zinc-800 px-3 py-2">웹 서비스 호스팅</td>
                  <td className="border border-zinc-800 px-3 py-2">미국</td>
                  <td className="border border-zinc-800 px-3 py-2">서비스 계약 기간</td>
                </tr>
                <tr>
                  <td className="border border-zinc-800 px-3 py-2">Mixpanel, Inc.</td>
                  <td className="border border-zinc-800 px-3 py-2">서비스 이용 행태 분석</td>
                  <td className="border border-zinc-800 px-3 py-2">미국</td>
                  <td className="border border-zinc-800 px-3 py-2">서비스 계약 기간</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">6. 정보주체의 권리·의무</h2>
            <p className="text-zinc-400 mb-2">이용자는 언제든지 아래 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc list-inside space-y-1 text-zinc-400">
              <li>개인정보 열람 요청</li>
              <li>오류 정정 요청</li>
              <li>삭제 요청</li>
              <li>처리 정지 요청</li>
            </ul>
            <p className="mt-3 text-zinc-400">
              권리 행사는 아래 개인정보 보호책임자에게 이메일로 요청하시면 지체 없이 처리하겠습니다.
            </p>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">7. 개인정보 보호책임자</h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-zinc-400 space-y-1">
              <p><span className="text-zinc-300">회사명:</span> 주식회사 포뮬라엑스</p>
              <p><span className="text-zinc-300">책임자:</span> 대표이사</p>
              <p><span className="text-zinc-300">이메일:</span> chris@proby.io</p>
            </div>
          </section>

          <section>
            <h2 className="text-white font-semibold text-base mb-3">8. 개인정보처리방침 변경</h2>
            <p className="text-zinc-400">
              본 방침은 법령·서비스 변경에 따라 개정될 수 있으며, 변경 시 서비스 내 공지를 통해 안내합니다.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
