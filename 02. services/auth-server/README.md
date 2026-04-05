## Proby Company Auth Server

간단한 **기업회원 전용 로그인/회원가입 + 관리자 승인** 서버입니다.

### 1. 실행 방법

```bash
cd "40. 신사업팀 (바이브코딩)/auth-server"
npm install
npm run dev
```

- 기본 포트: `http://localhost:4000`
- 정적 파일 루트: `40. 신사업팀 (바이브코딩)` (즉, `Empowered/index.html`, `portfolio/index.html` 등을 그대로 서빙)

### 1-1. 이메일(SMTP) 설정

가입 신청 내용을 `chris@proby.io` 로 보내려면 `.env` 파일에 SMTP 정보를 넣어야 합니다.

예시 (`auth-server/.env`):

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_app_password
SMTP_SECURE=false
SMTP_FROM=Proby <no-reply@proby.io>
```

> Gmail 등을 사용할 경우, 일반 비밀번호 대신 **앱 비밀번호**를 쓰는 것을 추천합니다.

`.env` 를 만든 뒤에는 서버를 다시 시작해야 합니다:

```bash
cd "40. 신사업팀 (바이브코딩)/auth-server"
npm run dev
```

SMTP 환경변수가 하나도 없으면 서버 로그에
`[auth-server] SMTP 환경변수가 설정되지 않아 메일 전송을 건너뜁니다.` 가 찍히고,
이 경우 가입은 되지만 메일은 보내지지 않습니다.

### 2. 주요 기능

- **기업회원 회원가입**
  - `POST /api/auth/signup-company`
  - 필수 필드:
    - `login_id`, `password`, `company_name`
    - `business_reg_number`, `contact_email`
    - 파일: `business_reg_file` (사업자등록증, 최대 5MB)
  - 생성된 계정은 `status = 'pending'` 상태이며 **관리자 승인 전에는 로그인 불가**입니다.

- **아이디 중복 체크**
  - `POST /api/auth/check-id`
  - Body: `{ "loginId": "원하는아이디" }`
  - 응답: `{ "available": true | false }`

- **로그인**
  - `POST /api/auth/login`
  - Body: `{ "login_id": "...", "password": "..." }`
  - 조건:
    - 비밀번호 일치
    - `status = 'approved'` 인 경우에만 성공

- **현재 로그인 상태 조회**
  - `GET /api/auth/me`
  - 응답 예:
    ```json
    {
      "isLoggedIn": true,
      "hasPaidPlan": true,
      "user": {
        "id": 1,
        "login_id": "company1",
        "company_name": "프로비",
        "status": "approved",
        "plan_type": "paid"
      }
    }
    ```

- **관리자용 API (간단)**
  - `GET /api/admin/users?status=pending` – 상태별 목록
  - `POST /api/admin/users/:id/approve` – 승인
  - `POST /api/admin/users/:id/reject` – 거절
  - `POST /api/admin/users/:id/set-paid` – 유료 플랜 전환
  - 실제 관리자 인증은 `requireAdmin` 미들웨어에서 **세션의 `isAdmin` 플래그**로 판단합니다.
    - 초기에는 DB에서 직접 `is_admin = 1` 로 올려주면 됩니다.

### 3. 데이터베이스

- SQLite 파일: `auth.db`
- `users` 테이블 스키마:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  company_name TEXT NOT NULL,
  business_reg_number TEXT NOT NULL,
  business_reg_file_path TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  plan_type TEXT NOT NULL DEFAULT 'free', -- free | paid
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. 프론트엔드 연동 포인트

- `Empowered/login.html` 에서:
  - `/api/auth/check-id`, `/api/auth/signup-company`, `/api/auth/login` 호출
- `portfolio/index.html` 에서:
  - 페이지 로드 시 `/api/auth/me` 호출 → `window.AUTH_STATE` 세팅
  - `지원자 연락하기` 버튼은 `AUTH_STATE` 기반으로
    - 비로그인 → `/login?type=company`
    - 로그인(무료) → `/paywall/contact`
    - 로그인+유료 → 연락처 정보 노출

