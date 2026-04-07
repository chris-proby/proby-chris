# proby-template (Vercel static)

정적 HTML 모듈을 한 프로젝트로 배포합니다.

## 로컬 미리보기

```bash
cd "02. services/proby-template"
npx serve .
```

## Vercel 배포

```bash
cd "02. services/proby-template"
npx vercel              # 프리뷰
npx vercel --prod       # 프로덕션
```

- **Root directory**: 이 폴더(`proby-template`)를 Vercel 프로젝트 루트로 지정합니다.
- **Framework preset**: Other (또는 Static).
- `Brand assets/` 는 배포용으로 이 디렉터리 안에 복사본이 있습니다. 원본은 `02. services/Brand assets/` 에서 동기화하세요.

## 엔트리

- `/` — 모듈 링크 인덱스 (`index.html`)
- `/H_module/H_module`, `/J_module/J_module` 등 — `cleanUrls` 로 `.html` 생략 가능
