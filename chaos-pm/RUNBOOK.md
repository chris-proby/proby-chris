# chaos-pm Operations Runbook

운영 중 발생하는 흔한 사고에 대한 즉시 대응 절차.
새로운 사람도 이 문서만 보고 1차 대응할 수 있게 작성.

---

## 🚨 사고 우선순위

| Sev | 정의 | 대응 시간 | 예시 |
|-----|------|-----------|------|
| **P0** | 전체 서비스 중단, 데이터 손실 | 즉시 | 사이트 503, DB 다운, 잘못된 마이그레이션 |
| **P1** | 핵심 기능 장애, 일부 유저 영향 | 1시간 내 | 로그인 안 됨, 협업 sync 실패, 파일 업로드 막힘 |
| **P2** | 비핵심 기능 버그 | 24시간 내 | 특정 위젯 렌더 에러, UI 깨짐 |
| **P3** | 코스메틱 이슈 | 일주일 내 | 색상, 정렬, 오타 |

---

## 🔍 모니터링 대시보드 (북마크 권장)

| 도구 | 용도 | URL |
|------|------|-----|
| Vercel Dashboard | 배포·로그·트래픽 | https://vercel.com/churryboys-projects-9bab66ff/chaos-pm |
| Vercel Logs (CLI) | 실시간 함수 로그 | `vercel logs chaos-pm.vercel.app` |
| Supabase Dashboard | DB·Auth·Storage | https://supabase.com/dashboard/project/nnshbsbxnkruklivuojc |
| Supabase Logs | DB/Auth 에러 | Dashboard → Logs |
| Liveblocks Dashboard | 룸·MAU·연결수 | https://liveblocks.io/dashboard |
| Sentry (DSN 설정 후) | 클라이언트 에러 | https://sentry.io |
| Mixpanel | 사용자 행동 | https://mixpanel.com |

---

## 🔄 백업 & 복구

### 자동 백업 (현재 동작)
- **Vercel Cron**: 매일 03:00 KST (18:00 UTC)에 `/api/cron/backup` 실행
- **저장 위치**: Supabase Storage `canvas-files/_backups/{YYYY-MM-DD}/full-{timestamp}.json`
- **보관 기간**: 30일 (이후 자동 삭제)
- **포함 데이터**: profiles, canvases, canvas_members, files 전체 + 캔버스별 최신 스냅샷
- **제외**: 실시간 Liveblocks Storage 상태 (스냅샷에서 5분~15초 단위로 보존됨)

### Supabase 자체 백업 (Pro+ 필요)
- Free tier: 7일 일일 백업 (자동, 복구는 support 티켓)
- Pro tier ($25/mo): PITR (Point-In-Time Recovery, 7일 윈도우)
- **배포 직전 Pro로 업그레이드 권장**

### 수동 백업 트리거
```bash
# Vercel 대시보드 → chaos-pm → Crons → "Trigger Run"
# 또는 CLI:
curl -X GET https://chaos-pm.vercel.app/api/cron/backup \
  -H "Authorization: Bearer $CRON_SECRET"
```

### 복구 절차 (P0 — 데이터 손실 발생)
1. **즉시 신규 가입/쓰기 막기**: Vercel 환경변수 `MAINTENANCE_MODE=true` 추가 (별도 구현 필요) 또는 Supabase Dashboard → Auth → Disable signups
2. **백업 파일 다운로드**: Supabase Dashboard → Storage → canvas-files → _backups/{날짜}
3. **로컬에서 검증**: JSON 파싱 OK, 예상 row 수 일치
4. **DB 복구**:
   - 최신 백업이 24h 이내면: 백업 import + Liveblocks 룸 데이터로 패치
   - 최신 백업이 24h 초과면: 사용자 통지 + Supabase support 문의
5. **사용자 통지**: 영향받은 사용자에게 이메일 (가능하면)
6. **사후 분석**: 24시간 내 incident report 작성 (`/incidents/{날짜}-{slug}.md`)

---

## 🩺 사고 대응 체크리스트

### 사이트 다운 (P0)
1. [ ] Vercel Dashboard → Deployments → 최근 배포 상태 확인 (Failed?)
2. [ ] 최근 30분 내 배포가 있으면 → **이전 배포로 즉시 롤백** (Vercel UI에서 한 클릭)
3. [ ] 롤백 후에도 다운이면 → Supabase 대시보드에서 DB 상태 확인
4. [ ] 모두 정상인데 다운이면 → Vercel status (https://www.vercel-status.com)
5. [ ] 사용자에게 트위터/슬랙으로 공지

```bash
# 빠른 롤백 명령어
vercel rollback <deployment-url-of-last-good>
```

### 로그인 안 됨 (P1)
1. [ ] Supabase Dashboard → Authentication → Logs 확인
2. [ ] Google OAuth면 Google Cloud Console → APIs & Services 확인
3. [ ] 환경변수 (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) 점검
4. [ ] Supabase 무료 티어 가입 한도 확인 (시간당 3개 / 일 30개)
5. [ ] 임시 우회: 이미 가입한 사용자는 `requestPasswordReset`로 재인증 안내

### 협업 sync 안 됨 (P1)
1. [ ] Liveblocks Dashboard → Usage → 동시접속자 한도 초과?
2. [ ] `vercel logs` → `/api/liveblocks-auth` 에러율 확인
3. [ ] `LIVEBLOCKS_SECRET_KEY` 환경변수 점검 (만료/회전 안 했는지)
4. [ ] 단일 룸 100명 한도 초과: 사용자에게 룸 분할 안내

### 파일 업로드 실패 (P1)
1. [ ] Supabase Dashboard → Storage → 사용량 확인 (Free 1GB 한도)
2. [ ] `vercel logs` → `/api/files/upload-url` 에러 확인
3. [ ] RLS 정책 변경 여부 (Storage → Policies)

### Snapshot 백업 실패 (P2)
1. [ ] `vercel logs` → `/api/canvas/snapshot` 에러율
2. [ ] Storage 한도 초과면 retention 줄이기 (db/0004 `purge_old_snapshots`)
3. [ ] 사용자 영향 미미 (Liveblocks에는 정상 저장됨, 백업만 지연)

### 비밀번호 brute force / 가짜 가입 폭주 (P1)
1. [ ] Supabase Dashboard → Authentication → Rate limits 강화
2. [ ] `/api/liveblocks-auth` rate limit 조정 (`lib/rate-limit.ts`, 현재 30/min)
3. [ ] 의심 IP 패턴 → Vercel Edge Config에 차단 룰 추가

---

## 🔐 시크릿 회전 절차

정기적으로 (분기에 1회) 또는 노출 의심 시 즉시 회전:

| 시크릿 | 회전 위치 | 무중단 절차 |
|--------|----------|------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → Reset | 새 키 생성 → Vercel env 업데이트 → 재배포. 구 키는 즉시 무효화. |
| `LIVEBLOCKS_SECRET_KEY` | Liveblocks Dashboard → API Keys → Rotate | Vercel env 업데이트 → 재배포. 룸 토큰은 ~1h 내 자연 만료. |
| Google OAuth Secret | Google Cloud Console → Credentials → Reset | Supabase Auth → Google provider 업데이트. 진행 중 OAuth 흐름은 실패. |
| `CRON_SECRET` | 본인이 새 random string 생성 | Vercel env 업데이트 → 재배포. |

---

## 📈 성능 모니터링

### 정기 점검 항목 (주 1회)
- [ ] Vercel Analytics → Core Web Vitals (LCP < 2.5s, INP < 200ms)
- [ ] Supabase → Database → CPU, Connections (peak < 80%)
- [ ] Liveblocks → MAU, 동시 룸 수
- [ ] Sentry → 에러율 (베이스라인 + 알림 임계값)

### 임계값 도달 시 액션
| 메트릭 | 임계값 | 액션 |
|--------|--------|------|
| Supabase DB connections | > 60 (free 한도 60) | Supabase Pro 업그레이드 |
| Supabase Storage | > 800MB | retention 정책 조정 또는 Pro 업그레이드 |
| Liveblocks MAU | > 90% 한도 | 다음 티어 사전 업그레이드 |
| Vercel function invocations | 100k/day | 캐싱 강화 또는 Pro 업그레이드 |

---

## 🧪 부하 테스트 (분기 1회 권장)

```bash
# k6 설치 (macOS)
brew install k6

# 부하 테스트 실행
k6 run scripts/load-test.js
```

자세한 시나리오는 `scripts/load-test.js` 참고.

---

## 📞 비상 연락망

| 역할 | 담당 | 연락 |
|------|------|------|
| 1차 (오너) | Chris | (Slack/Phone) |
| Supabase | support@supabase.io | 무료티어 응답 시간 ~1주일 |
| Liveblocks | support@liveblocks.io | |
| Vercel | https://vercel.com/help | Pro 이상 빠른 응답 |
