# Proby 설문 패널

## Git / 배포 저장소 (중요)

이 프로젝트 변경분은 **`https://github.com/churryboy/panel.git`** 에만 푸시합니다.

- **`https://github.com/churryboy/casestudy.git`에는 이 폴더 작업을 올리지 않습니다.** (다른 레포와 혼동 금지)
- `panel` 저장소를 별도로 클론한 뒤, 이 폴더 내용을 동기화하여 커밋·푸시하세요.

### Vercel 프로덕션 (`proby-panel.vercel.app`) — **반드시 `main`**

**원인:** Vercel 프로덕션은 **`main` 브랜치만** 배포합니다. 최신 작업이 **`wip`에만** 있고 `main`에 머지되지 않으면, 프로덕션 사이트에는 반영되지 않습니다. (예: `main`이 PR #5 머지 커밋에서 멈춰 있고, 그 이후 `wip`에만 커밋이 쌓인 경우.)

**해결:** 기능 반영 후 아래 중 하나로 **`main`까지** 올립니다.

- GitHub에서 **PR: `wip` → `main` 머지**, 또는
- 로컬에서:
  ```bash
  git checkout main && git pull origin main
  git merge wip
  git push origin main
  ```

`main`에 푸시되면 Vercel이 새 프로덕션 배포를 시작합니다. 대시보드에서 1~2분 뒤 최신 배포가 뜨는지 확인하면 됩니다.

### 스타일이 전부 깨지고 로그인·회원가입·탭이 한 화면에 다 보일 때

- **원인:** `dist/tailwind.css` 또는 `styles.css`가 **404**이면 Tailwind 유틸(`.hidden` 등)이 없어져 레이아웃이 무너집니다.
- **로컬:** 반드시 **`panel` 폴더(이 프로젝트 루트)를** 서빙하세요. 상위 폴더에서 `serve`를 띄우면 `./dist/tailwind.css` 경로가 어긋납니다.
- **해결:** 이 폴더에서 `npm run build:css` 실행 후, `npm run serve` 로 같은 폴더를 띄웁니다.
- **Vercel:** 저장소에 `vercel.json`이 있으면 배포 시 `npm run build:css`로 `dist/tailwind.css`를 다시 생성합니다.

---

## ERR_ACCESS_DENIED / 스크립트가 안 뜰 때

브라우저는 **로컬 파일(`file://`)로 열면** 보안상 `app.js`, `styles.css` 같은 리소스 로딩을 막을 수 있습니다.  
**반드시 로컬 서버로 띄워서** 접속하세요.

### 방법 1 (권장)

```bash
cd "02. services/panel"
npm install
npm run build:css
npm run serve
```

브라우저에서 표시된 주소(예: http://localhost:3000)로 접속합니다.

### 로컬에 API 키(Resend 등) 두는 방법

- **저장 위치:** 프로젝트 루트에 **`.env.local`** 파일을 만들고 키를 넣습니다. (이 파일은 `.gitignore`에 포함되어 **Git에 올라가지 않습니다.**)
- **템플릿:** `.env.example`을 복사해 `.env.local`로 이름만 바꾼 뒤 값을 채우면 됩니다.
- **주의:** Resend API 키는 **코드나 README에 직접 적지 마세요.** Vercel 배포 시에는 **Vercel 대시보드 → Environment Variables**에 동일한 이름으로 등록합니다.
- **서버리스 API 테스트:** `npm run serve`만 쓰면 정적 파일만 서빙되어 `/api/email/send` 등이 동작하지 않을 수 있습니다. 이메일 발송까지 로컬에서 보려면 `npx vercel dev`로 띄우고, `.env.local`을 읽는지 확인하세요.

### 이메일 인증 발송이 500 / 실패할 때

1. **Vercel 환경변수:** `RESEND_API_KEY`가 배포 프로젝트에 들어가 있는지 확인합니다. (로컬 `.env`만 넣고 Vercel에는 안 넣으면 **프로덕션에서만** 실패합니다.)
2. **Supabase:** `email_verifications` 테이블이 없으면 DB 저장 단계에서 실패합니다. `SUPABASE_SETUP.sql`의 해당 섹션을 Supabase에서 실행했는지 확인합니다.
3. **Resend 발신 주소:** `noreply@임의도메인`은 **Resend에서 도메인 인증 전에는 사용할 수 없습니다.** 테스트는 `EMAIL_FROM=onboarding@resend.dev`로 두고, Resend 계정에 등록한 **본인 이메일 주소로만** 수신 테스트가 가능합니다. 실제 가입자에게 보내려면 도메인을 Resend에 추가·인증한 뒤 `EMAIL_FROM`을 그 도메인 주소로 바꿉니다.

### 방법 2

```bash
cd "02. services/panel"
npm run build:css
python3 -m http.server 8765
```

이후 http://localhost:8765 로 접속합니다.

---

## Tailwind CSS (프로덕션용)

CDN 대신 빌드된 CSS를 쓰면 콘솔 경고가 사라지고 프로덕션에 적합합니다.

- **최초 1회·CSS 수정 후:**  
  `npm install` → `npm run build:css`  
- 생성된 파일: `dist/tailwind.css` (이 파일을 그대로 배포하면 됩니다)

---

## Mixpanel 유입 경로(이메일·Gmail 등)

브라우저는 **개인정보 보호** 때문에 `document.referrer`(리퍼러)를 **아예 비우는 경우**가 많습니다.  
특히 **Gmail·아웃룩·메일 앱**에서 링크를 눌렀을 때는 리퍼러가 없어서 Mixpanel에 **`entry_source: direct`**, **`referrer` 빈 값**으로 보이는 것이 **정상적인 동작**일 수 있습니다.

**정확히 채널을 나누려면** 링크에 UTM을 붙이는 방식이 가장 확실합니다.

예시:

```text
https://panel-sand-one.vercel.app/?view=app&utm_source=gmail&utm_medium=email&utm_campaign=panel_launch
```

- `utm_source`: gmail, newsletter, kakao 등
- `utm_medium`: email, social 등
- `utm_campaign`: 캠페인명

앱은 이미 위 파라미터를 읽어 모든 이벤트에 붙입니다.  
리퍼러가 없을 때는 **`referrer_present: false`** 로 구분할 수 있습니다.
