# Proby Design System
> **Dark Navy** — 내부 데이터 도구, 리서치 대시보드, 인터뷰 뷰어에 공통 적용되는 디자인 시스템  
> 기준 파일: `00.pds/header-template.html`, `H_module/proby-template/H_module.html` 등 (2026-04-05 기준)

---

## 1. 컨셉 & 원칙

| 원칙 | 설명 |
|---|---|
| **Dark-first** | 배경은 항상 거의 순흑(#0A0A0B). 표면 레이어를 단계적으로 밝힘 |
| **Navy accent** | 강조색은 딥 네이비 계열 단일 팔레트. 브랜드 전용 포인트 컬러 없음 |
| **Density without noise** | 많은 정보를 좁은 면적에 담되, 계층·여백·불투명도로 신호 분리 |
| **No decorative fonts** | Pretendard 단일 폰트 패밀리. 고정폭·디스플레이 폰트 미사용 |
| **Subtle texture** | SVG fractalNoise noise overlay로 평판 배경에 질감 부여 |

---

## 2. 디자인 토큰

### 2-1. CSS Custom Properties (`:root`)

```css
:root {
  /* ── Backgrounds / Surfaces ── */
  --bg:          #0A0A0B;   /* 페이지 배경         Black/2   */
  --surface:     #111114;   /* 띄워진 표면          Black/5   */
  --card:        #19191E;   /* 카드·글래스 베이스   Black/10  */
  --border:      #25252D;   /* 경계선·구분선        Black/20  */

  /* ── Accent / Interactive — Dark Navy ── */
  --accent-dim:  #1E3050;   /* 배경 액센트 (dim)   DarkNavy/30 */
  --accent:      #28406E;   /* 버튼·하이라이트     DarkNavy/40 */
  --accent-hi:   #4168AF;   /* 밝은 액센트 (절제)  DarkNavy/60 */
  --accent-text: #7DA3E0;   /* 액센트 텍스트       DarkNavy/80 */
  --accent-lt:   #A3C2EF;   /* 라이트 액센트 텍스트 DarkNavy/90 */
}
```

### 2-2. 컬러 팔레트 시각화

```
배경 레이어 (어두운 순)
  ██  #0A0A0B  --bg          페이지 배경
  ██  #111114  --surface     플로팅 서피스
  ██  #19191E  --card        카드
  ██  #25252D  --border      보더

액센트 레이어 (어두운 순)
  ██  #1E3050  --accent-dim  배경 블롭·오버레이
  ██  #28406E  --accent      버튼 fill
  ██  #4168AF  --accent-hi   아이콘·포커스링
  ██  #7DA3E0  --accent-text 레이블·카운터
  ██  #A3C2EF  --accent-lt   그래디언트 끝점·호버
```

### 2-3. 시맨틱 컬러 (고정값)

| 용도 | 색 코드 | 사용 클래스 |
|---|---|---|
| 성공·합격 | `rgba(52,211,153,…)` | `.status-badge.pass`, `.eval-point.positive`, `.tag-chip.green`, `.score-bar-fill.green` |
| 경고·보류 | `rgba(251,191,36,…)` | `.status-badge.hold`, `.eval-point.caution`, `.tag-chip.amber`, `.score-bar-fill.amber` |
| 위험·불합격 | `rgba(248,113,113,…)` | `.status-badge.reject`, `.eval-point.negative`, `.tag-chip.red`, `.score-bar-fill.red` |
| 검토중·navy | `rgba(65,104,175,…)` | `.status-badge.review`, `.tag-chip.cyan`, `.score-bar-fill.cyan` |
| 보조·퍼플 | `rgba(167,139,250,…)` | `.tag-chip.purple`, `.score-bar-fill.purple` |

---

## 3. 타이포그래피

### 3-1. 폰트 스택

```html
<!-- Head에 반드시 포함 -->
<link rel="stylesheet" as="style"
  href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css"
  integrity="sha384-y9k2lBaj/ETgBd4674Kql3098euvZU5fWlBcBBrlROBI6c2KDmjWhd508Rfsx9R/"
  crossorigin="anonymous"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
```

```js
// Tailwind 설정
tailwind.config = {
  theme: { extend: { fontFamily: {
    display: ['Pretendard','-apple-system','BlinkMacSystemFont','system-ui','sans-serif']
  }}}
}
```

```css
body {
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  color: rgba(255,255,255,.82);
}
```

### 3-2. 텍스트 스케일

| 역할 | font-size | font-weight | 색상 | 클래스/용도 |
|---|---|---|---|---|
| Hero H1 | `2.6rem` | 900 | white | `.grad-text` 적용 |
| Section Label | `0.6rem` | 900 | `--accent-text` / opacity .7 | `.section-label` |
| Widget Title | `0.68rem` | 900 | `rgba(255,255,255,.35)` | `.widget-title` |
| Meta Label | `0.46–0.52rem` | 900 | `rgba(255,255,255,.22)` | `.strip-meta-lbl`, `.upanel-cell-lbl` |
| Body / Value | `0.62–0.7rem` | 400–600 | `rgba(255,255,255,.55)` | 일반 메타값 |
| Sub / Caption | `0.52–0.58rem` | 400 | `rgba(255,255,255,.28–.3)` | 보조 설명 |
| Badge / Tag | `0.48–0.58rem` | 600–700 | 시맨틱 컬러별 | `.tag-chip`, `.widget-badge` |

### 3-3. 그래디언트 헤드라인

```css
.grad-text {
  background: linear-gradient(135deg, #ffffff 20%, var(--accent-lt) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## 4. 기본 레이아웃

### 4-1. 페이지 컨테이너

```css
/* noise texture overlay */
body::before {
  content: '';
  position: fixed; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none; z-index: 1; opacity: 0.5;
}

.page {
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 0 6rem;
  position: relative;
  z-index: 2;
}
```

### 4-2. Hero 섹션

```css
.ct-hero {           /* 또는 .hh-hero, .[page]-hero */
  padding: 2.5rem 2rem 3.5rem;
  position: relative;
  overflow: hidden;
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(140px);
  pointer-events: none;
}
```

```html
<section class="ct-hero">
  <!-- blob 1 — 대형 앰비언트, 좌상단 -->
  <div class="blob w-[700px] h-[700px]"
       style="background:#1E3050;opacity:0.18;top:-200px;left:-150px;"></div>
  <!-- blob 2 — 소형, 우측 -->
  <div class="blob w-[400px] h-[400px]"
       style="background:#25252D;opacity:0.15;top:100px;right:-100px;"></div>

  <div class="relative" style="display:flex;align-items:flex-start;gap:2.5rem;flex-wrap:wrap;">
    <!-- 좌: 제목 + 설명 -->
    <div style="flex:1;min-width:260px;">
      <div class="section-label">PROBY · Page Subtitle</div>
      <h1 style="font-size:2.6rem;font-weight:900;letter-spacing:-.03em;line-height:1.15;margin-bottom:.75rem;">
        <span class="grad-text">키워드</span><br>제목
      </h1>
      <p style="font-size:.88rem;color:rgba(255,255,255,.42);max-width:480px;line-height:1.75;margin-bottom:.3rem;">
        주요 설명 한 줄.
      </p>
      <p style="font-size:.75rem;color:var(--accent-text);opacity:.45;max-width:520px;line-height:1.65;">
        보조 설명 또는 사용 안내.
      </p>
    </div>
    <!-- 우: 로고 컬럼 — 클라이언트 로고(위) → Proby 로고(아래) 고정 순서 -->
    <div style="flex-shrink:0;padding-top:.5rem;display:flex;flex-direction:column;align-items:flex-end;gap:.75rem;">
      <!-- ① 클라이언트 로고 (공동 브랜딩 시 반드시 Proby보다 위에 위치) -->
      <!-- <img src="../../../Brand assets/{클라이언트폴더}/{파일명}" alt="Client Brand"
           style="height:44px;object-fit:contain;border-radius:.5rem;opacity:.85;"/> -->
      <!-- ② Proby 로고 — 항상 최하단 고정 -->
      <img src="../../../Brand assets/proby/logo-text-white.png" alt="Proby"
           style="height:22px;object-fit:contain;opacity:.7;"/>
    </div>
  </div>
</section>
```

---

## 5. 로고 & Brand Assets

### 5-1. Brand Assets 폴더 구조

모든 로고·이미지 애셋은 **`02. services/Brand assets/`** 하위에 보관한다.  
HTML에서 참조 시 상대 경로 `../../../Brand assets/` 를 사용한다. (기준 파일: `proby-template/{Module}/proby-template/{Module}.html`, `proby-template/{Module}/proby_template/{Module}.html`, `proby-template/00.pds/header-template.html` 등, `02. services` 기준으로 세 단계 상위.)

```
02. services/Brand assets/
  ├── proby/
  │     └── logo-text-white.png   ← Proby 공식 로고 (흰색, 가로형)
  ├── {클라이언트명}/
  │     └── logo.png / logo.svg   ← 클라이언트별 로고 파일
  └── …
```

> 새로운 클라이언트 애셋이 필요하면 `Brand assets/{클라이언트명}/` 폴더를 생성하고 파일을 넣는다.

### 5-2. Hero 로고 배치 규칙

Hero 우측 컬럼의 로고 순서는 **항상 아래 규칙을 따른다**:

| 순서 | 로고 | 크기 | 비고 |
|---|---|---|---|
| ① **위** | 클라이언트 로고 | `height: 44px` | 공동 브랜딩 시에만 표시 |
| ② **아래** | Proby 로고 | `height: 22px`, `opacity: .7` | 항상 표시, 항상 최하단 |

- 클라이언트 로고가 없는 순수 Proby 페이지는 Proby 로고만 표시한다.
- 클라이언트 로고가 있을 경우 반드시 클라이언트가 위, Proby가 아래다. 순서를 바꾸지 않는다.
- 두 로고 사이 간격은 `gap: .75rem`.

```html
<!-- 우: 로고 컬럼 — 클라이언트(위) → Proby(아래) 고정 순서 -->
<div style="flex-shrink:0;padding-top:.5rem;display:flex;flex-direction:column;align-items:flex-end;gap:.75rem;">
  <!-- ① 클라이언트 로고 (공동 브랜딩 시 사용) -->
  <img src="../../../Brand assets/{클라이언트폴더}/{파일명}" alt="Client Name"
       style="height:44px;object-fit:contain;border-radius:.5rem;opacity:.85;"/>
  <!-- ② Proby 로고 — 항상 최하단 고정 -->
  <img src="../../../Brand assets/proby/logo-text-white.png" alt="Proby"
       style="height:22px;object-fit:contain;opacity:.7;"/>
</div>
```

---

## 6. 컴포넌트

### 6-1. Sticky Candidate Strip

페이지 최상단에 고정되는 탐색·메타 정보 바.

```css
.candidate-strip {
  position: sticky; top: 0; z-index: 50;
  background: rgba(10,10,11,.93);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,.06);
  padding: .55rem 1.5rem .5rem;
  display: flex; align-items: center; gap: .75rem;
}

/* nav pill (prev/next + counter) */
@keyframes strip-glow {
  0%, 100% { box-shadow: 0 0 0 1px rgba(65,104,175,.12), 0 0 8px rgba(65,104,175,.07); }
  50%       { box-shadow: 0 0 0 1px rgba(65,104,175,.28), 0 0 16px rgba(65,104,175,.15); }
}
.candidate-nav {
  display: flex; align-items: center; gap: .3rem; flex-shrink: 0;
  background: rgba(65,104,175,.07);
  border: 1px solid rgba(65,104,175,.2);
  border-radius: .52rem; padding: .2rem .28rem;
  animation: strip-glow 3s ease-in-out infinite;
}

/* nav button */
.nav-btn {
  width: 30px; height: 30px; border-radius: .38rem;
  background: rgba(65,104,175,.09); border: 1px solid rgba(65,104,175,.28);
  color: rgba(125,163,224,.7); cursor: pointer; transition: all .18s;
  display: flex; align-items: center; justify-content: center;
  font-family: inherit; flex-shrink: 0;
}
.nav-btn:hover  { background: rgba(65,104,175,.2); color: #A3C2EF; border-color: rgba(65,104,175,.65); box-shadow: 0 0 10px rgba(65,104,175,.22); }
.nav-btn:disabled { opacity: .15; cursor: default; pointer-events: none; }
.nav-btn .material-symbols-outlined { font-size: 1.1rem !important; }

/* counter */
.nav-counter {
  font-size: .52rem; font-weight: 700; color: rgba(125,163,224,.6);
  letter-spacing: .06em; min-width: 26px; text-align: center; line-height: 1;
}

/* avatar */
.candidate-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, rgba(14,24,48,.95), rgba(30,48,80,.8));
  border: 1.5px solid rgba(65,104,175,.45);
  display: flex; align-items: center; justify-content: center;
  font-size: .82rem; font-weight: 900; color: rgba(125,163,224,.9);
  letter-spacing: -.02em; flex-shrink: 0;
}

/* name / sub */
.candidate-name { font-size: .88rem; font-weight: 800; color: rgba(255,255,255,.88); }
.candidate-sub  { font-size: .58rem; color: rgba(255,255,255,.3); margin-top: .08rem; }

/* vertical divider */
.strip-divider { width: 1px; height: 28px; background: rgba(255,255,255,.08); flex-shrink: 0; }

/* meta items */
.strip-meta      { display: flex; align-items: center; gap: 1.25rem; }
.strip-meta-item { display: flex; flex-direction: column; gap: .05rem; }
.strip-meta-lbl  { font-size: .46rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.22); }
.strip-meta-val  { font-size: .62rem; color: rgba(255,255,255,.55); }
```

```html
<div class="candidate-strip" id="candidate-strip">
  <div class="candidate-nav">
    <button class="nav-btn" id="prev-btn" onclick="navigate(-1)">
      <span class="material-symbols-outlined">chevron_left</span>
    </button>
    <span class="nav-counter" id="nav-counter">1 / 3</span>
    <button class="nav-btn" id="next-btn" onclick="navigate(1)">
      <span class="material-symbols-outlined">chevron_right</span>
    </button>
  </div>
  <div class="candidate-identity">
    <div class="candidate-avatar" id="strip-avatar">K</div>
    <div>
      <div class="candidate-name" id="strip-name">홍길동</div>
      <div class="candidate-sub" id="strip-pos">백엔드 개발자 · 경력 5년</div>
    </div>
  </div>
  <div class="strip-divider"></div>
  <div class="strip-meta">
    <div class="strip-meta-item">
      <div class="strip-meta-lbl">일시</div>
      <div class="strip-meta-val" id="strip-date">2026-04-02</div>
    </div>
  </div>
  <div class="strip-divider"></div>
  <span class="status-badge review" id="strip-status">검토 중</span>
</div>
```

---

### 6-2. Status Badge

```css
.status-badge {
  font-size: .52rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  padding: .18rem .55rem; border-radius: .32rem;
}
.status-badge.pass    { background: rgba(52,211,153,.12);  border: 1px solid rgba(52,211,153,.25);  color: rgba(52,211,153,.85); }
.status-badge.hold    { background: rgba(251,191,36,.1);   border: 1px solid rgba(251,191,36,.22);  color: rgba(251,191,36,.8); }
.status-badge.reject  { background: rgba(248,65,65,.12);   border: 1px solid rgba(248,65,65,.22);   color: rgba(248,113,113,.8); }
.status-badge.review  { background: rgba(65,104,175,.12);  border: 1px solid rgba(65,104,175,.28);  color: rgba(125,163,224,.9); }
```

```html
<span class="status-badge pass">합격</span>
<span class="status-badge hold">보류</span>
<span class="status-badge reject">불합격</span>
<span class="status-badge review">검토 중</span>
```

---

### 6-3. Tag Chip

```css
.tag-chip {
  display: inline-flex; align-items: center; gap: .22rem;
  font-size: .58rem; font-weight: 600; padding: .18rem .52rem;
  border-radius: .32rem;
}
.tag-chip.cyan   { background: rgba(65,104,175,.12);   border: 1px solid rgba(65,104,175,.22);   color: rgba(163,194,239,.85); }
.tag-chip.green  { background: rgba(52,211,153,.1);    border: 1px solid rgba(52,211,153,.2);    color: rgba(52,211,153,.8); }
.tag-chip.amber  { background: rgba(251,191,36,.1);    border: 1px solid rgba(251,191,36,.2);    color: rgba(251,191,36,.8); }
.tag-chip.purple { background: rgba(167,139,250,.1);   border: 1px solid rgba(167,139,250,.2);   color: rgba(167,139,250,.8); }
.tag-chip.red    { background: rgba(248,113,113,.1);   border: 1px solid rgba(248,113,113,.2);   color: rgba(248,113,113,.8); }

.tags-row { display: flex; flex-wrap: wrap; gap: .3rem; margin-bottom: .65rem; }
```

```html
<div class="tags-row">
  <span class="tag-chip cyan">React 전문가</span>
  <span class="tag-chip green">성능 최적화</span>
  <span class="tag-chip amber">영어 보완 필요</span>
  <span class="tag-chip purple">리더십 잠재력</span>
  <span class="tag-chip red">리서치 경험 부족</span>
</div>
```

---

### 6-4. Widget Shell

카드 형태의 콘텐츠 컨테이너. 헤더(아이콘·타이틀·배지) + 바디 구조.

```css
.widget-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
}

.widget {
  background: rgba(255,255,255,.02);
  border: 1px solid rgba(255,255,255,.07);
  border-radius: 1rem;
  overflow: hidden;
  display: flex; flex-direction: column;
}
.widget.span-full { grid-column: 1 / -1; }

.widget-header {
  display: flex; align-items: center; gap: .5rem;
  padding: .75rem 1rem .65rem;
  border-bottom: 1px solid rgba(255,255,255,.05);
}
.widget-icon {
  width: 28px; height: 28px; border-radius: .4rem;
  background: rgba(65,104,175,.08); border: 1px solid rgba(65,104,175,.2);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.widget-icon .material-symbols-outlined { font-size: .95rem !important; color: rgba(125,163,224,.7); }
.widget-title {
  font-size: .68rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(255,255,255,.35);
}
.widget-badge {
  margin-left: auto;
  font-size: .48rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
  padding: .12rem .42rem; border-radius: .24rem;
  background: rgba(65,104,175,.09); border: 1px solid rgba(65,104,175,.2);
  color: rgba(125,163,224,.6);
}
.widget-body { flex: 1; padding: 1rem; }
```

```html
<div class="widget-grid">
  <div class="widget">
    <div class="widget-header">
      <div class="widget-icon">
        <span class="material-symbols-outlined">description</span>
      </div>
      <span class="widget-title">위젯 타이틀</span>
      <span class="widget-badge">42 items</span>
    </div>
    <div class="widget-body">
      <!-- 콘텐츠 -->
    </div>
  </div>

  <!-- 전체 너비 위젯 -->
  <div class="widget span-full">…</div>
</div>
```

---

### 6-5. Meta Cell (소형 정보 셀)

```css
.video-meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: .5rem; margin-top: .75rem; }
.video-meta-cell {
  background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.055);
  border-radius: .5rem; padding: .42rem .6rem;
}
.video-meta-lbl { font-size: .46rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.22); margin-bottom: .12rem; }
.video-meta-val { font-size: .64rem; color: rgba(255,255,255,.55); }
```

---

### 6-6. Transcript Viewer

```css
.transcript-search {
  display: flex; align-items: center; gap: .5rem;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
  border-radius: .5rem; padding: .35rem .6rem; margin-bottom: .75rem;
}
.transcript-scroll { height: 340px; overflow-y: auto; display: flex; flex-direction: column; gap: .5rem; }
.transcript-scroll::-webkit-scrollbar       { width: 3px; }
.transcript-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 2px; }

.tx-line { display: flex; gap: .65rem; align-items: flex-start; }
.tx-time    { flex-shrink: 0; font-size: .52rem; font-weight: 700; color: rgba(125,163,224,.45); width: 38px; }
.tx-speaker { flex-shrink: 0; font-size: .55rem; font-weight: 700; color: rgba(255,255,255,.28); width: 56px; text-transform: uppercase; }
.tx-text    { font-size: .7rem; color: rgba(255,255,255,.55); line-height: 1.58; }

/* 강조 라인 */
.tx-line.highlighted .tx-text {
  color: rgba(255,255,255,.82);
  background: rgba(65,104,175,.09);
  border-radius: .3rem; padding: .1rem .35rem; margin-left: -.35rem;
}

/* 섹션 구분선 */
.tx-section-divider { display: flex; align-items: center; gap: .5rem; margin: .25rem 0; }
.tx-section-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,.05); }
.tx-section-label {
  font-size: .48rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase;
  color: rgba(255,255,255,.16); white-space: nowrap;
}
```

**검색 하이라이트 마크 (JS)**
```js
line.text.replace(
  new RegExp(`(${query})`, 'gi'),
  '<mark style="background:rgba(65,104,175,.28);color:inherit;border-radius:2px;">$1</mark>'
)
```

---

### 6-7. Evaluation — Summary & Points

```css
.eval-summary {
  font-size: .78rem; color: rgba(255,255,255,.55); line-height: 1.75;
  border-left: 2px solid rgba(65,104,175,.45); padding-left: .85rem;
  margin-bottom: 1rem;
}
.eval-summary strong { color: rgba(255,255,255,.8); font-weight: 700; }

.eval-section-lbl {
  font-size: .52rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(255,255,255,.22); margin-bottom: .5rem;
}

.eval-point {
  display: flex; align-items: flex-start; gap: .55rem;
  background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.055);
  border-radius: .55rem; padding: .55rem .7rem;
}
.eval-point.positive .eval-point-icon .material-symbols-outlined { color: rgba(52,211,153,.7); }
.eval-point.caution  .eval-point-icon .material-symbols-outlined { color: rgba(251,191,36,.7); }
.eval-point.negative .eval-point-icon .material-symbols-outlined { color: rgba(248,113,113,.7); }
.eval-point-label { font-size: .56rem; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; margin-bottom: .15rem; }
.eval-point.positive .eval-point-label { color: rgba(52,211,153,.5); }
.eval-point.caution  .eval-point-label { color: rgba(251,191,36,.45); }
.eval-point.negative .eval-point-label { color: rgba(248,113,113,.45); }
.eval-point-text { font-size: .68rem; color: rgba(255,255,255,.52); line-height: 1.55; }
```

```html
<div class="eval-point positive">
  <div class="eval-point-icon"><span class="material-symbols-outlined">check_circle</span></div>
  <div class="eval-point-body">
    <div class="eval-point-label">강점</div>
    <div class="eval-point-text">구체적인 평가 내용.</div>
  </div>
</div>
<!-- type: positive / caution / negative -->
```

---

### 6-8. Score Bar

```css
.score-card {
  background: rgba(255,255,255,.025); border: 1px solid rgba(255,255,255,.06);
  border-radius: .65rem; padding: .65rem .8rem;
}
.score-card-lbl { font-size: .5rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.25); margin-bottom: .35rem; }
.score-bar-bg   { flex: 1; height: 5px; background: rgba(255,255,255,.06); border-radius: 3px; overflow: hidden; }
.score-bar-fill { height: 100%; border-radius: 3px; transition: width .6s cubic-bezier(.4,0,.2,1); }

/* 색상 변형 */
.score-bar-fill.green  { background: linear-gradient(90deg, rgba(52,211,153,.5),  rgba(52,211,153,.85)); }
.score-bar-fill.cyan   { background: linear-gradient(90deg, rgba(65,104,175,.45), rgba(65,104,175,.9)); }
.score-bar-fill.amber  { background: linear-gradient(90deg, rgba(251,191,36,.4),  rgba(251,191,36,.8)); }
.score-bar-fill.purple { background: linear-gradient(90deg, rgba(167,139,250,.4), rgba(167,139,250,.85)); }
.score-bar-fill.red    { background: linear-gradient(90deg, rgba(248,113,113,.4), rgba(248,113,113,.8)); }

.score-num { font-size: .68rem; font-weight: 700; color: rgba(255,255,255,.55); flex-shrink: 0; min-width: 24px; text-align: right; }
```

---

### 6-9. Verdict Box

```css
.verdict-box {
  background: rgba(65,104,175,.07); border: 1px solid rgba(65,104,175,.25);
  border-radius: .65rem; padding: .75rem .85rem;
}
.verdict-lbl  { font-size: .48rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: rgba(125,163,224,.5); margin-bottom: .4rem; }
.verdict-text { font-size: .82rem; font-weight: 800; line-height: 1.45; }
.verdict-sub  { font-size: .62rem; color: rgba(125,163,224,.5); margin-top: .3rem; line-height: 1.55; }
```

**JS에서 verdict 색상 결정**
```js
const verdictColors = {
  pass:   'rgba(52,211,153,.85)',
  hold:   'rgba(251,191,36,.8)',
  reject: 'rgba(248,113,113,.8)',
  review: 'rgba(125,163,224,.9)',
};
document.getElementById('verdict-text').style.color = verdictColors[status];
```

---

### 6-10. Upload Zone

파일 업로드 영역. 드래그·클릭 공용. `has-file` 클래스로 업로드 완료 상태를 표현한다.

```css
.upload-zone {
  background: var(--card);
  border: 1.5px dashed rgba(65,104,175,.2);
  border-radius: .75rem;
  padding: 1.75rem 1.5rem;
  cursor: pointer; transition: all .2s;
  position: relative; overflow: hidden;
}
.upload-zone:hover {
  border-color: rgba(65,104,175,.45);
  background: rgba(65,104,175,.06);
  box-shadow: 0 0 0 1px rgba(65,104,175,.1), 0 8px 28px rgba(0,0,0,.25);
}
.upload-zone.has-file {
  border-style: solid;
  border-color: rgba(65,104,175,.4);
  background: rgba(65,104,175,.05);
}
.upload-zone input[type=file] {
  position: absolute; inset: 0; opacity: 0;
  cursor: pointer; width: 100%; height: 100%;
}
.upload-zone-label {
  font-size: .52rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
  color: var(--accent-text); opacity: .5; margin-bottom: .6rem;
}
.upload-zone-title {
  font-size: .95rem; font-weight: 700; color: rgba(255,255,255,.82); margin-bottom: .35rem;
}
.upload-zone-desc {
  font-size: .72rem; color: rgba(255,255,255,.3); line-height: 1.6;
}
.upload-zone-icon {
  width: 40px; height: 40px; border-radius: .5rem;
  background: rgba(65,104,175,.08); border: 1px solid rgba(65,104,175,.18);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: .75rem;
  color: var(--accent-hi);
}
.upload-file-name {
  display: none; margin-top: .75rem;
  font-size: .72rem; color: var(--accent-hi);
  background: rgba(65,104,175,.08); border: 1px solid rgba(65,104,175,.2);
  border-radius: .4rem; padding: .35rem .65rem;
  align-items: center; gap: .4rem;
}
.upload-zone.has-file .upload-file-name { display: flex; }
```

```html
<div class="upload-zone" id="zone-screener">
  <input type="file" id="file-screener" accept=".xlsx,.csv,.pdf"
         onchange="handleFile('screener', this)"/>
  <div class="upload-zone-label">01 · Screener</div>
  <div class="upload-zone-icon">
    <span class="material-symbols-outlined" style="font-size:1.2rem;">filter_alt</span>
  </div>
  <div class="upload-zone-title">스크리너 업로드</div>
  <div class="upload-zone-desc">대상자 선별 기준이 담긴 파일을 업로드하세요.<br>.xlsx · .csv · .pdf</div>
  <div class="upload-file-name" id="fname-screener">
    <span class="material-symbols-outlined" style="font-size:.9rem;color:var(--accent-hi);">check_circle</span>
    <span id="fname-screener-text">—</span>
  </div>
</div>
```

---

### 6-11. Chat Interface

리서치 설계 어시스턴트 채팅 패널. `.chat-box` 내부에 헤더·메시지 목록·입력창이 flex column으로 배치된다.

```css
/* 박스 쉘 */
.chat-box {
  background: var(--card);
  border: 1px solid rgba(255,255,255,.06);
  border-radius: 1rem;
  display: flex; flex-direction: column;
  overflow: hidden;
}
/* 헤더 */
.chat-header {
  display: flex; align-items: center; gap: .5rem;
  padding: .65rem 1rem;
  border-bottom: 1px solid rgba(255,255,255,.05);
  flex-shrink: 0;
}
.chat-header-icon {
  width: 26px; height: 26px; border-radius: .35rem;
  background: rgba(65,104,175,.1); border: 1px solid rgba(65,104,175,.18);
  display: flex; align-items: center; justify-content: center;
  color: var(--accent-hi);
}
.chat-header-title { font-size: .75rem; font-weight: 700; color: rgba(255,255,255,.75); }
.chat-header-sub   { font-size: .6rem; color: rgba(255,255,255,.28); margin-left: auto; }

/* 메시지 목록 */
.chat-messages {
  flex: 1; overflow-y: auto;
  padding: 1rem 1rem .5rem;
  display: flex; flex-direction: column; gap: .65rem;
}
.chat-messages::-webkit-scrollbar { width: 3px; }
.chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

/* 빠른 시작 칩 */
.chat-suggestions { display: flex; flex-direction: column; gap: .5rem; padding: .25rem 0; }
.chat-suggest-label {
  font-size: .52rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase;
  color: rgba(255,255,255,.18); margin-bottom: .2rem;
}
.chat-chip {
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
  border-radius: .45rem; padding: .6rem .85rem;
  font-size: .7rem; color: rgba(255,255,255,.38); line-height: 1.5;
  cursor: pointer; transition: all .15s; text-align: left;
}
.chat-chip:hover {
  background: rgba(65,104,175,.08); border-color: rgba(65,104,175,.28);
  color: var(--accent-lt); box-shadow: 0 0 10px rgba(65,104,175,.1);
}
.chat-chip strong { color: rgba(255,255,255,.55); font-weight: 600; }

/* 메시지 버블 */
.chat-msg { display: flex; gap: .5rem; max-width: 88%; }
.chat-msg.user { align-self: flex-end; flex-direction: row-reverse; }

.chat-ai-dot {
  width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, rgba(14,26,58,.9), rgba(28,52,100,.7));
  border: 1px solid rgba(65,104,175,.3);
  display: flex; align-items: center; justify-content: center;
  font-size: .6rem; color: var(--accent-hi); font-weight: 800;
  margin-top: .1rem;
}
.chat-bubble {
  font-size: .72rem; line-height: 1.6; padding: .55rem .8rem;
  border-radius: .6rem; max-width: 100%;
}
.chat-msg.ai .chat-bubble {
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07);
  color: rgba(255,255,255,.62);
}
.chat-msg.user .chat-bubble {
  background: rgba(65,104,175,.14); border: 1px solid rgba(65,104,175,.28);
  color: rgba(255,255,255,.78);
}

/* 입력창 */
.chat-input-row {
  display: flex; align-items: center; gap: .5rem;
  padding: .65rem 1rem .75rem; flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,.05);
}
.chat-input {
  flex: 1; background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08); border-radius: .4rem;
  padding: .45rem .75rem; font-size: .75rem; color: rgba(255,255,255,.75);
  font-family: inherit; outline: none; resize: none; min-height: 34px;
}
.chat-input:focus { border-color: rgba(65,104,175,.4); }
.chat-input::placeholder { color: rgba(255,255,255,.2); }
.chat-send-btn {
  width: 34px; height: 34px; flex-shrink: 0;
  background: rgba(65,104,175,.15); border: 1px solid rgba(65,104,175,.3);
  border-radius: .4rem; cursor: pointer; color: var(--accent-hi);
  display: flex; align-items: center; justify-content: center;
  transition: all .15s; font-family: inherit;
}
.chat-send-btn:hover { background: rgba(65,104,175,.25); box-shadow: 0 0 12px rgba(65,104,175,.2); }
```

> **`.chat-ai-dot` 배경 규칙:** 반드시 `linear-gradient(135deg, rgba(14,26,58,…), rgba(28,52,100,…))` — 과거 사용된 다크 그린(`rgba(1,38,21,…)`, `rgba(1,77,36,…)`)은 금지.

---

### 6-12. CTA Start Button

데이터 수집 또는 분석 시작을 트리거하는 주요 행동 버튼.

```css
.start-btn-wrap {
  display: flex; align-items: center; gap: 1rem;
}
.start-btn {
  display: inline-flex; align-items: center; gap: .55rem;
  background: linear-gradient(135deg, #4168AF, #28406E);
  color: rgba(255,255,255,.95);
  font-size: .85rem; font-weight: 800; letter-spacing: -.01em;
  padding: .8rem 1.75rem;
  border-radius: .55rem;
  border: 1px solid rgba(65,104,175,.35); cursor: pointer;
  transition: all .2s;
  box-shadow: 0 0 24px rgba(65,104,175,.2);
  font-family: inherit;
}
.start-btn:hover {
  background: linear-gradient(135deg, #5A84C8, #4168AF);
  border-color: rgba(125,163,224,.55);
  box-shadow: 0 0 36px rgba(65,104,175,.35);
  transform: translateY(-1px);
}
.start-btn:disabled { opacity: .4; cursor: not-allowed; transform: none; }
.start-hint { font-size: .72rem; color: rgba(255,255,255,.25); }
```

```html
<div class="start-btn-wrap">
  <button class="start-btn" id="start-btn" disabled onclick="startCollection()">
    <span class="material-symbols-outlined" style="font-size:1rem;">play_circle</span>
    사전 지식 수집 시작
  </button>
  <span class="start-hint" id="start-hint">스크리너·가이드라인을 모두 업로드하거나, 어시스턴트와 채팅을 1회 이상 하면 활성화됩니다</span>
</div>
```

**JS 상태 관리 패턴**
```js
function checkStartReady() {
  const btn = document.getElementById('start-btn');
  const hint = document.getElementById('start-hint');
  if (!isReady) {
    btn.disabled = true;
    hint.textContent = '조건 미충족 안내';
    hint.style.color = 'rgba(255,255,255,.25)';
    return;
  }
  btn.disabled = false;
  hint.textContent = '준비 완료 — 버튼을 클릭하면 수집이 시작됩니다';
  hint.style.color = 'rgba(65,104,175,.4)';
}
```

---

### 6-13. Language Toggle Button

전사록·응답 영역의 언어 전환 버튼 (한국어 ↔ 원문).

```css
/* 헤더 우측에 배치 */
#tx-lang-toggle {
  margin-left: auto;
  font-size: .58rem; font-weight: 700; letter-spacing: .04em;
  padding: .22rem .65rem; border-radius: .32rem;
  background: rgba(65,104,175,.1); border: 1px solid rgba(65,104,175,.25);
  color: rgba(125,163,224,.8); cursor: pointer;
  transition: all .15s; font-family: inherit;
}
#tx-lang-toggle:hover {
  background: rgba(65,104,175,.2); border-color: rgba(65,104,175,.45);
}
#tx-lang-toggle.original-mode {
  background: rgba(251,191,36,.08); border-color: rgba(251,191,36,.25);
  color: rgba(251,191,36,.8);
}
```

```html
<!-- widget-header 우측 끝에 삽입 -->
<button id="tx-lang-toggle" onclick="toggleTranscriptLang()">한국어 보기</button>
```

```js
let showKorean = true;
function toggleTranscriptLang() {
  showKorean = !showKorean;
  const btn = document.getElementById('tx-lang-toggle');
  btn.textContent = showKorean ? '원문 보기' : '한국어 보기';
  btn.classList.toggle('original-mode', !showKorean);
  renderTranscript(currentLines, '');
}
```

---

### 6-14. Transcript Dual-Language

전사록에서 번역(한국어)과 원문을 동시에 표시하는 라인 구조. 언어 토글 버튼으로 원문 표시 여부 제어.

```css
/* 번역 텍스트 (기본: 한국어 번역) */
.tx-translation {
  font-size: .68rem; font-weight: 500;
  color: rgba(255,255,255,.78); line-height: 1.6; margin-bottom: .2rem;
}
/* 인터뷰어 발화 — 배지 형태 */
.tx-translation.is-badge {
  display: inline-flex; align-items: center; gap: .25rem;
  font-size: .6rem; font-weight: 600; letter-spacing: .02em;
  color: rgba(255,255,255,.38); background: rgba(255,255,255,.06);
  border-radius: .25rem; padding: .1rem .4rem; margin-bottom: .25rem;
}
/* 원문 (한국어 모드에서 숨김, 원문 모드에서 표시) */
.tx-original {
  font-size: .62rem; color: rgba(255,255,255,.3); line-height: 1.55;
  border-left: 2px solid rgba(255,255,255,.08); padding-left: .5rem; margin-top: .15rem;
}
```

**JS 언어 토글 패턴**
```js
let showKorean = true;
// renderTranscript 내부 — 원문 모드에서 번역 숨기고 원문 표시
lines.forEach(line => {
  const displayText = showKorean
    ? (line.translation_ko || line.text)   // 번역 우선
    : line.text;                            // 원문
  const subText = showKorean
    ? null                                  // 원문 숨김
    : (line.translation_ko || null);        // 번역을 부제로
});
```

---

### 6-15. Markdown Report Body

서버에서 fetch하거나 인라인 데이터로 제공되는 MD 파일을 HTML로 렌더링하는 컴포넌트. `.md-report-body` 컨테이너 안에서만 사용.

```css
.md-report-body { font-size: .84rem; color: rgba(255,255,255,.6); line-height: 1.8; }

/* 섹션 헤딩 */
.md-report-body .md-h2 {
  font-size: .58rem; font-weight: 900; letter-spacing: .12em; text-transform: uppercase;
  color: rgba(125,163,224,.7); margin: 1.1rem 0 .45rem;
  border-bottom: 1px solid rgba(65,104,175,.15); padding-bottom: .3rem;
}
.md-report-body .md-h2:first-child { margin-top: .1rem; }

/* 메타 배지 라인 */
.md-report-body .md-meta {
  font-size: .7rem; color: rgba(255,255,255,.35); margin-bottom: .8rem;
  border-left: 2px solid rgba(65,104,175,.25); padding-left: .6rem;
}

/* 핵심 요약 한 줄 */
.md-report-body .md-summary-line {
  font-size: .82rem; font-weight: 700; color: rgba(255,255,255,.85);
  border-left: 2px solid rgba(125,163,224,.55); padding-left: .7rem;
  margin-bottom: .7rem; line-height: 1.55;
}

/* Key-Value 테이블 */
.md-report-body .md-kv-table { display: flex; flex-direction: column; gap: .28rem; margin-bottom: .5rem; }
.md-report-body .md-kv-row {
  display: grid; grid-template-columns: 7rem 1fr;
  gap: .5rem; align-items: baseline;
  padding: .28rem .5rem; background: rgba(255,255,255,.025);
  border-radius: .28rem; border: 1px solid rgba(255,255,255,.04);
}
.md-report-body .md-kv-key {
  font-size: .62rem; font-weight: 800; letter-spacing: .04em;
  color: rgba(255,255,255,.4); text-transform: uppercase; word-break: keep-all;
}
.md-report-body .md-kv-val { font-size: .76rem; color: rgba(255,255,255,.7); line-height: 1.55; }

/* 인용구 */
.md-report-body .md-blockquote {
  border-left: 2px solid rgba(125,163,224,.5); padding: .4rem .7rem;
  margin: .35rem 0; background: rgba(65,104,175,.05); border-radius: 0 .3rem .3rem 0;
  font-style: italic; color: rgba(255,255,255,.65); font-size: .76rem;
}

/* 불릿 리스트 */
.md-report-body .md-bullet-list { list-style: none; padding: 0; margin: .25rem 0 .5rem; }
.md-report-body .md-bullet-list li::before { content: '·'; color: rgba(125,163,224,.7); margin-right: .4rem; }
.md-report-body .md-bullet-list li { color: rgba(255,255,255,.6); font-size: .76rem; }

/* 기타 */
.md-report-body .md-para   { margin: .25rem 0; color: rgba(255,255,255,.55); font-size: .76rem; }
.md-report-body .md-bold   { color: rgba(255,255,255,.85); font-weight: 700; }
.md-report-body .md-hr     { border: none; border-top: 1px solid rgba(255,255,255,.06); margin: .8rem 0; }
.md-report-body .md-sublabel {
  font-size: .68rem; font-weight: 800; color: rgba(255,255,255,.5);
  letter-spacing: .03em; margin: .7rem 0 .2rem;
}
```

---

### 6-16. Summary Grid Card Layout

MD 보고서 파일을 분석해 그리드 카드 레이아웃으로 렌더링하는 컴포넌트. `6-15 Markdown Report Body` 내부에서 사용.

```css
/* 참여자 메타 배지 */
.md-report-body .mdc-meta-badge {
  display: inline-block; font-size: .68rem; color: rgba(255,255,255,.38);
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
  border-radius: 2rem; padding: .22rem .75rem; margin-bottom: .9rem;
}

/* 히어로 카드 (핵심 요약) */
.md-report-body .mdc-hero {
  background: rgba(65,104,175,.07); border: 1px solid rgba(65,104,175,.2);
  border-radius: .55rem; padding: .85rem 1rem .9rem; margin-bottom: .75rem;
}
.md-report-body .mdc-hero-body p { color: rgba(255,255,255,.7); font-size: .84rem; line-height: 1.8; margin: 0; }

/* 2열 그리드 */
.md-report-body .mdc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: .55rem; margin-bottom: .55rem; }

/* 일반 카드 */
.md-report-body .mdc-card {
  background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07);
  border-radius: .5rem; padding: .75rem .85rem; overflow: hidden;
}
.md-report-body .mdc-card--full { grid-column: 1 / -1; margin-bottom: .55rem; }
.md-report-body .mdc-card--voc  { border-color: rgba(65,104,175,.18); background: rgba(65,104,175,.04); }

/* 카드 타이틀 */
.md-report-body .mdc-card-title {
  display: flex; align-items: center; gap: .4rem;
  font-size: .82rem; font-weight: 800; color: rgba(255,255,255,.82);
  margin-bottom: .55rem; padding-bottom: .45rem;
  border-bottom: 1px solid rgba(255,255,255,.08);
}
.md-report-body .mdc-icon { font-size: .9rem; }

/* 카드 내부 요소 */
.md-report-body .mdc-sublabel {
  font-size: .62rem; font-weight: 800; color: rgba(125,163,224,.75);
  letter-spacing: .04em; margin: .6rem 0 .18rem;
}
.md-report-body .mdc-sublabel:first-child { margin-top: 0; }
.md-report-body .mdc-para { color: rgba(255,255,255,.6); line-height: 1.75; margin: .2rem 0 .4rem; font-size: .82rem; }

/* KV 테이블 (카드 버전 — 컬럼 좁음) */
.md-report-body .mdc-kv-table { display: flex; flex-direction: column; gap: .22rem; }
.md-report-body .mdc-kv-row {
  display: grid; grid-template-columns: 5.5rem 1fr; gap: .4rem; align-items: baseline;
  padding: .22rem .4rem; background: rgba(255,255,255,.025);
  border-radius: .25rem; border: 1px solid rgba(255,255,255,.04);
}
.md-report-body .mdc-kv-key { font-size: .65rem; font-weight: 800; color: rgba(255,255,255,.36); text-transform: uppercase; letter-spacing: .04em; }
.md-report-body .mdc-kv-val { font-size: .8rem; color: rgba(255,255,255,.65); line-height: 1.5; }

/* 불릿 리스트 (카드 버전) */
.md-report-body .mdc-bullet { list-style: none; padding: 0; margin: .15rem 0 .4rem; display: flex; flex-direction: column; gap: .28rem; }
.md-report-body .mdc-bullet li {
  display: flex; align-items: flex-start; gap: .4rem;
  font-size: .8rem; color: rgba(255,255,255,.6); line-height: 1.65;
  padding: .2rem 0; border-bottom: 1px solid rgba(255,255,255,.04);
}
.md-report-body .mdc-bullet li:last-child { border-bottom: none; }
.md-report-body .mdc-bullet li::before { content: '·'; color: rgba(125,163,224,.8); flex-shrink: 0; font-size: 1rem; line-height: 1.4; }

/* VOC 인용구 */
.md-report-body .mdc-quote-group { display: flex; flex-direction: column; gap: .55rem; }
.md-report-body .mdc-quote {
  display: flex; gap: .5rem; align-items: flex-start;
  padding: .5rem .65rem; background: rgba(255,255,255,.03);
  border-radius: .35rem; border-left: 2px solid rgba(125,163,224,.5);
}
.md-report-body .mdc-quote-mark {
  font-size: 1.8rem; line-height: 1; color: rgba(65,104,175,.35);
  font-family: Georgia, serif; flex-shrink: 0; margin-top: -.1rem;
}
.md-report-body .mdc-quote-orig  { font-size: .78rem; color: rgba(255,255,255,.55); line-height: 1.65; font-style: italic; }
.md-report-body .mdc-quote-trans { font-size: .77rem; color: rgba(125,163,224,.75); margin-top: .25rem; line-height: 1.55; }
```

**HTML 구조 예시**
```html
<div class="md-report-body">
  <div class="mdc-meta-badge">한국 · 20대 여성 · K-pop 팬</div>

  <!-- 히어로: 핵심 요약 -->
  <div class="mdc-hero">
    <div class="mdc-card-title"><span class="mdc-icon">🚀</span> 핵심 요약</div>
    <div class="mdc-hero-body"><p>한 줄 핵심 인사이트.</p></div>
  </div>

  <!-- 2열 그리드 -->
  <div class="mdc-grid">
    <div class="mdc-card">
      <div class="mdc-card-title"><span class="mdc-icon">✏️</span> 섹션 제목</div>
      <div class="mdc-card-body">
        <div class="mdc-sublabel">소제목</div>
        <p class="mdc-para">본문 내용.</p>
        <div class="mdc-kv-table">
          <div class="mdc-kv-row"><span class="mdc-kv-key">항목</span><span class="mdc-kv-val">값</span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- 전체 너비 VOC -->
  <div class="mdc-card mdc-card--full mdc-card--voc">
    <div class="mdc-card-title"><span class="mdc-icon">💬</span> 주요 인용</div>
    <div class="mdc-quote-group">
      <div class="mdc-quote">
        <span class="mdc-quote-mark">"</span>
        <div>
          <div class="mdc-quote-orig">원문 인용.</div>
          <div class="mdc-quote-trans">한국어 번역.</div>
        </div>
      </div>
    </div>
  </div>
</div>
```

---

## 7. 패턴 & 사용 규칙

### 레이어 계층
```
body (--bg)
  └── .page (z-index: 2)
        ├── .ct-hero  → blob 장식은 overflow hidden 내부에서만
        ├── .candidate-strip  → sticky top:0, z-index: 50
        └── .widget-grid  → 카드 그리드
```

### 불투명도 신호 체계
| 레벨 | alpha | 용도 |
|---|---|---|
| Primary | `.82` | 주요 본문 텍스트 |
| Secondary | `.55` | 값·설명 텍스트 |
| Tertiary | `.28–.35` | 메타·레이블 |
| Disabled | `.16–.22` | 비활성·섹션 구분 |
| Ghost | `.05–.09` | 배경 fill |

### 보더 규칙
- 배경 구분선: `1px solid rgba(255,255,255,.05–.08)`
- 카드 테두리: `1px solid rgba(255,255,255,.07)`
- 액센트 테두리: `1px solid rgba(65,104,175,.2–.28)`
- 포커스/강조: `1px solid rgba(65,104,175,.45–.65)` + `box-shadow`

### 레거시 컬러 금지 (Vigloo / 고객사 전용 틴트)
- **금지:** `rgba(0,180,160,…)` · `rgba(0,64,56,…)` · `rgba(0,46,40,…)` 등 청록·다크 그린 배경 틴트 (업로드 존 hover·파일 선택·CTA 그라데이션에 과거 사용됨)
- **금지:** `rgba(1,38,21,…)` · `rgba(1,77,36,…)` 다크 그린 — `.chat-ai-dot`, `.candidate-avatar` 배경에 과거 사용됨
- **대체:** 동일 용도는 위 액센트(navy) 토큰만 사용 — 업로드 존 hover는 `background: rgba(65,104,175,.08)` + 보더 강화, CTA는 `linear-gradient(135deg, var(--accent-hi), var(--accent))` + 본문색 `rgba(255,255,255,.95)`, 아바타·AI 도트는 `linear-gradient(135deg, rgba(14,26,58,…), rgba(28,52,100,…))`
- **요약 하이라이트(`.summ`):** 스카이 톤 `rgba(163,224,255,…)` 대신 팔레트 정렬 `rgba(163,194,239,.88)` 권장 (`tag-chip.cyan` 텍스트 계열)

### 반경(border-radius) 스케일
| 값 | 용도 |
|---|---|
| `.24rem` | 배지·뱃지 소형 |
| `.32rem` | status-badge, tag-chip |
| `.38rem` | nav-btn |
| `.4–.52rem` | widget-icon, candidate-nav |
| `.55–.65rem` | eval-point, score-card |
| `1rem` | widget (대형 카드) |

---

### Data Loading 패턴 (http:// & file:// 공용)

정적 HTML 모듈에서 외부 데이터 파일(영상·전사록·요약 MD)을 로드할 때 사용하는 패턴.
`fetch()`는 `file://`에서 브라우저 보안상 차단되므로 **인라인 fallback 전략**이 필수.

```js
/* 1. DATA_BASE — 이 파일 기준 상대 경로로 항상 계산 (http:// & file:// 공용) */
const DATA_BASE = (function() {
  const loc = window.location.href;
  // 파일 위치에 따라 상위 단계 조절:
  //   naver/I_module.html     → 3단계 상위
  //   I_module/I_module.html  → 4단계 상위
  const root = loc
    .replace(/\/[^\/]*$/, '')   // 파일명 제거
    .replace(/\/[^\/]*$/, '')   // 상위 1
    .replace(/\/[^\/]*$/, '')   // 상위 2
    .replace(/\/[^\/]*$/, '') + '/'; // 상위 3 (총 4단계)
  return root + 'ongoing/naver/K-pop%20-%20i%20module/';
})();
const IS_FILE_PROTO = window.location.protocol === 'file:';

/* 2. 인라인 데이터 embed (빌드 시 Python 스크립트로 갱신) */
const INLINE_SUMMARY    = { "참여자이름": "## 핵심 요약\n…" /*, …*/ };
const INLINE_TRANSCRIPT = { "참여자이름": "[인터뷰어] 질문\n[참여자] 답변…" /*, …*/ };

/* 3. 로드 함수 패턴 */
async function loadSummary(rawName, p) {
  if (!IS_FILE_PROTO) {
    try {
      const md = await fetch(DATA_BASE + 'summary/' + encodeURIComponent(rawName) + '_요약.md')
        .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); });
      renderSummaryFromMd(md, p);
      return;
    } catch(e) { /* fallthrough */ }
  }
  const inlineMd = INLINE_SUMMARY[rawName];
  if (inlineMd) renderSummaryFromMd(inlineMd, p); else renderSummary(p);
}

/* 4. 비디오 src — video 엘리먼트는 file:// URL도 직접 재생 가능 */
const vidSrc = DATA_BASE + 'video/' + encodeURIComponent(videoFileName);
videoContainer.innerHTML = `<video controls src="${vidSrc}" style="width:100%;height:100%;object-fit:contain;"></video>`;
```

> **인라인 데이터 갱신 방법:** `ongoing/{폴더}/summary/*.md`, `transcript/*.txt` 수정 후 Python 스크립트로 HTML 내 `INLINE_SUMMARY` / `INLINE_TRANSCRIPT` 상수를 재생성한다.

---

## 8. 파일 구조

```
02. services/
  ├── proby-template/             ← Proby 모듈·디자인 시스템 루트
  │     ├── 00.pds/
  │     │     ├── header-template.html   ← 새 페이지 보일러플레이트
  │     │     └── pds.md                 ← 이 파일 (디자인 시스템 레퍼런스)
  │     ├── A_module/, C_module/, H_module/, I_module/, J_module/
  │     ├── O_module/, P_module/, U_module/
  │     └── …/proby-template/ 또는 …/proby_template/  ← 모듈별 작업물
  ├── spoonlabs/                  ← 콘텐츠 모듈 (스푼랩스, services 루트)
  └── Brand assets/
        └── proby/logo-text-white.png
```

---

## 9. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-05 | `proby-template` 하위 폴더명 정리: `c_module` → `C_module`, `pds` → `00.pds`; Brand assets 상대경로 `../../../` 로 통일 |
| 2026-04-05 | 로고 & Brand Assets 규칙 섹션(5) 신규 추가 — 클라이언트 위·Proby 아래 배치 순서 명문화 |
| 2026-04-05 | Vigloo(비글루) teal 계열 완전 제거 → Proby dark navy 시스템으로 통일 |
| 2026-04-05 | Silkscreen 폰트 제거 → Pretendard 단일 폰트 패밀리 |
| 2026-04-05 | 디자인 시스템 MD 문서 초안 작성 |
| 2026-04-05 | A_module(E-BAT) PDS 전면 적용 완료 — Space Grotesk·Space Mono·Silkscreen 제거, `rgba(0,237,204,...)` → `rgba(65,104,175,...)`, canvas grad-navy 색상 navy 교체, scan-line grid 제거 |
| 2026-04-05 | **I_module** 템플릿 정리: LG U+ 브랜딩·통신사 특화 카피 제거, 데모 `ALL_PARTICIPANTS` 중립 데이터로 축소, Vigloo 잔재(teal 그린 업로드 hover·CTA 그라데이션·카드 hover 틴트) 제거 후 navy 토큰으로 통일; §7에 레거시 컬러 금지·대체 규칙 명시 |
| 2026-04-07 | Naver 공동 브랜딩 제거 — proby-template/I_module을 Proby 단독 템플릿으로 전환; `.chat-ai-dot`·`.candidate-avatar`의 다크 그린(`rgba(1,38,21)`, `rgba(1,77,36)`) → 다크 네이비(`rgba(14,26,58)`, `rgba(28,52,100)`)로 교체 |
| 2026-04-07 | **`--bg` / `--surface` / `--card` / `--border` 루트 변수 재발 수정** — I_module 작업 과정에서 Naver 의 어두운 그린 배경 팔레트(`#080B09`, `#0C110D`, `#111A12`, `#1C2B1D`)가 `:root`에 그대로 남아 업로드 존·채팅 박스가 초록 배경으로 보이던 문제 수정 → 올바른 다크 네이비 팔레트(`#0A0A0B`, `#111114`, `#19191E`, `#25252D`)로 교체 |
| 2026-04-07 | **I_module file:// 지원** — `DATA_BASE`를 항상 계산하도록 변경(file:// 포함), `INLINE_SUMMARY` / `INLINE_TRANSCRIPT` 상수 embed, `IS_FILE_PROTO` 플래그로 fetch/inline 분기; 비디오는 `file://` URL 직접 지정으로 재생 |
| 2026-04-07 | **pds.md §6 컴포넌트 대거 추가** — 6-10 Upload Zone, 6-11 Chat Interface, 6-12 CTA Start Button, 6-13 Language Toggle, 6-14 Transcript Dual-Language, 6-15 Markdown Report Body, 6-16 Summary Grid Card Layout; §7에 Data Loading 패턴 추가 |
