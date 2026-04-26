# chaos-pm Backend Setup

서버 인증·DB·스토리지를 Supabase로 전환하는 1회성 셋업 가이드.

---

## 1. Supabase 프로젝트 생성 (~5분)

1. https://supabase.com/dashboard → **New project**
2. 입력값
   - Name: `chaos-pm`
   - Database Password: **강력한 비밀번호로 설정** (DB 접속용, 1Password 등에 보관)
   - Region: `Northeast Asia (Seoul)` (한국 사용자 기준)
   - Plan: **Free** (베타까지 충분)
3. 프로젝트 생성 완료 후 좌측 메뉴 **Project Settings → API**에서 다음 3개 값 복사:
   - `Project URL` → `VITE_SUPABASE_URL` / `SUPABASE_URL`
   - `anon public` 키 → `VITE_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **절대 클라이언트 노출 금지**

---

## 2. SQL 마이그레이션 실행 (Supabase SQL Editor)

좌측 메뉴 **SQL Editor → New query**에서 **반드시 순서대로** 실행:

1. `db/0001_initial_schema.sql`
2. `db/0002_rls_policies.sql`
3. `db/0003_storage.sql`
4. `db/0004_helpers.sql`

각 파일 전체를 복사 → 붙여넣기 → **Run**.
정상이면 "Success. No rows returned" 메시지가 나옵니다.

---

## 3. Auth 설정 (Supabase Dashboard)

**Authentication → Providers → Email**:
- Enable Email Provider: ✅
- Confirm email: ✅ (운영용 권장)
- Secure email change: ✅

**Authentication → URL Configuration**:
- Site URL: `https://chaos-pm.vercel.app`
- Redirect URLs (한 줄씩):
  - `http://localhost:5173`
  - `https://chaos-pm.vercel.app`
  - `https://chaos-pm.vercel.app/**`

**Authentication → Rate Limits** (보호 강화):
- Email signups per hour: `30` (기본 30 → 그대로)
- Token verifications per 5 minutes: `30`

---

## 4. Liveblocks Secret Key 발급

https://liveblocks.io/dashboard → 프로젝트 → API Keys → **Secret Key** 복사 →
`LIVEBLOCKS_SECRET_KEY` 환경변수에 저장.

(기존 `VITE_LIVEBLOCKS_PUBLIC_KEY`는 더 이상 운영에서 사용 안 함. 로컬 개발용으로만 유지 가능.)

---

## 5. Vercel 환경변수 등록

Vercel 대시보드 → chaos-pm 프로젝트 → **Settings → Environment Variables**
또는 CLI:

```bash
vercel env add VITE_SUPABASE_URL          # Production, Preview, Development
vercel env add VITE_SUPABASE_ANON_KEY     # Production, Preview, Development
vercel env add SUPABASE_SERVICE_ROLE_KEY  # Production, Preview만 (Development 제외)
vercel env add LIVEBLOCKS_SECRET_KEY      # Production, Preview만
```

⚠️ `SUPABASE_SERVICE_ROLE_KEY`와 `LIVEBLOCKS_SECRET_KEY`는 **server-only**.
이름이 `VITE_`로 시작하지 않아야 클라이언트 번들에 포함되지 않음.

---

## 6. 로컬 개발용 `.env.local` 작성

```bash
cd chaos-pm
cp .env.example .env.local
# 편집해서 실제 키 채우기
```

또는 Vercel에서 한 번에 풀:
```bash
vercel env pull .env.local
```

---

## 7. 배포

```bash
cd chaos-pm
vercel --prod
```

배포 후 https://chaos-pm.vercel.app 에서 회원가입 → 이메일 인증 → 로그인 흐름 확인.

---

## 검증 체크리스트

- [ ] 새 이메일로 회원가입 → 인증 메일 수신 → 링크 클릭 → 자동 로그인
- [ ] Supabase Dashboard → Authentication → Users 에 신규 사용자 생성됨
- [ ] Supabase Dashboard → Table Editor → `profiles`, `canvases`, `canvas_members` 에 자동 row 생성 확인
- [ ] 위젯 추가 → Liveblocks 룸 정상 연결 (브라우저 콘솔에 "liveblocks auth failed" 없는지)
- [ ] 다른 브라우저(시크릿 모드)에서 같은 계정 로그인 → 동일한 캔버스 보임 (cross-device sync 동작)
- [ ] 로그아웃 → 세션 정리 확인

---

## 운영 모니터링 권장

- **Supabase Dashboard → Logs** : Auth/DB 에러 확인
- **Vercel Dashboard → Logs**   : 서버리스 함수 에러 확인
- **Liveblocks Dashboard → Usage** : MAU/룸 사용량 확인
- 추후 Sentry 도입 (Phase 1-2)

---

## 롤백 플랜

Supabase 환경변수 미설정 시 코드는 자동으로 **로컬 모드**로 폴백 (기존 localStorage 인증).
운영에서 문제 발생하면 Vercel에서 `VITE_SUPABASE_URL` 변수 삭제 → 재배포로 즉시 롤백.
