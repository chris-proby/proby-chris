#!/usr/bin/env python3
"""
B 양식 PDF → A 양식 PDF 변환 스크립트
마크다운 요약 파일을 파싱하여 A 양식 HTML 생성 후 Chrome headless로 PDF 렌더링
"""

import os
import re
import subprocess
import tempfile
import sys

# ───────────────────────────────────────────────────────────
# 마크다운 파서
# ───────────────────────────────────────────────────────────

def parse_markdown(md_text):
    """마크다운을 섹션 딕셔너리로 파싱"""
    sections = {}
    current_section = None
    current_content = []

    for line in md_text.splitlines():
        if line.startswith('## '):
            if current_section:
                sections[current_section] = '\n'.join(current_content).strip()
            current_section = line[3:].strip()
            current_content = []
        elif line.startswith('# ') or line.strip() == '---':
            pass
        else:
            if current_section:
                current_content.append(line)

    if current_section:
        sections[current_section] = '\n'.join(current_content).strip()

    return sections


def parse_basic_info(section_text):
    """기본 정보 테이블 파싱 → {항목: 내용}"""
    info = {}
    for line in section_text.splitlines():
        m = re.match(r'\|\s*(.+?)\s*\|\s*(.+?)\s*\|', line)
        if m and m.group(1) not in ('항목', '------', '---'):
            info[m.group(1).strip()] = m.group(2).strip()
    return info


def parse_table(section_text):
    """마크다운 테이블 파싱 → [(col1, col2), ...]"""
    rows = []
    for line in section_text.splitlines():
        m = re.match(r'\|\s*(.+?)\s*\|\s*(.+?)\s*\|', line)
        if m:
            c1, c2 = m.group(1).strip(), m.group(2).strip()
            if c1 not in ('활동', '------', '---', '항목') and not c1.startswith('-'):
                rows.append((c1, c2))
    return rows


def parse_bullets(text):
    """- 로 시작하는 bullet 파싱"""
    bullets = []
    for line in text.splitlines():
        line = line.strip()
        if line.startswith('- '):
            bullets.append(line[2:].strip())
        elif line.startswith('* '):
            bullets.append(line[2:].strip())
    return bullets


def parse_numbered(text):
    """1. 2. 형식 numbered list 파싱 → [(title, body)]"""
    items = []
    current_title = None
    current_body = []
    for line in text.splitlines():
        m = re.match(r'^\d+\.\s+\*?\*?(.+?)\*?\*?\s*$', line.strip())
        if m:
            if current_title:
                items.append((current_title, ' '.join(current_body).strip()))
            current_title = m.group(1).strip().strip('*')
            current_body = []
        elif line.strip().startswith('-') and current_title:
            current_body.append(line.strip()[1:].strip())
        elif line.strip().startswith('>') and current_title:
            current_body.append(line.strip()[1:].strip().strip('"'))
    if current_title:
        items.append((current_title, ' '.join(current_body).strip()))
    return items


def parse_achievement(section_text):
    """주요 성과 파싱 → {title, subtitle, items: {배경,역할,결과,...}}"""
    title = ''
    items = {}
    current_key = None

    for line in section_text.splitlines():
        line = line.strip()
        if line.startswith('**') and line.endswith('**') and '배경' not in line:
            title = line.strip('*').strip()
        elif line.startswith('- **배경'):
            current_key = '배경'
            items[current_key] = re.sub(r'\*\*배경[:\*]*\*?\*?\s*', '', line[2:]).strip(' *:')
        elif line.startswith('- **역할'):
            current_key = '역할'
            items[current_key] = re.sub(r'\*\*역할[:\*]*\*?\*?\s*', '', line[2:]).strip(' *:')
        elif line.startswith('- **결과'):
            current_key = '결과'
            items[current_key] = re.sub(r'\*\*결과[:\*]*\*?\*?\s*', '', line[2:]).strip(' *:')
        elif line.startswith('- **의미'):
            current_key = '의미'
            items[current_key] = re.sub(r'\*\*의미[:\*]*\*?\*?\s*', '', line[2:]).strip(' *:')
        elif line.startswith('- **협업'):
            current_key = '협업'
            items[current_key] = re.sub(r'\*\*협업[:\*]*\*?\*?\s*', '', line[2:]).strip(' *:')
        elif current_key and line and not line.startswith('#'):
            # 연속 라인
            items[current_key] = items.get(current_key, '') + ' ' + line.strip()

    return {'title': title, 'items': items}


# ───────────────────────────────────────────────────────────
# HTML 변환 헬퍼
# ───────────────────────────────────────────────────────────

def esc(text):
    """HTML escape"""
    return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;'))


def bold_md(text):
    """**bold** 마크다운을 <strong> 태그로 변환"""
    return re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', esc(text))


def bullets_html(bullets, cls=''):
    if not bullets:
        return ''
    items = ''.join(f'<li>{bold_md(b)}</li>' for b in bullets)
    return f'<ul class="{cls}">{items}</ul>'


# ───────────────────────────────────────────────────────────
# HTML 생성
# ───────────────────────────────────────────────────────────

def generate_html(sections, name, affiliation):
    # --- 섹션별 내용 파싱 ---
    career_bg = parse_bullets(sections.get('경력 배경', ''))
    current_job_raw = sections.get('현재 업무', '')
    achievement_raw = sections.get('주요 성과', '')
    career_goals_raw = sections.get('커리어 목표', '')
    skills_raw = sections.get('역량 개발 활동', '')
    conflict_raw = sections.get('갈등 상황 대응 사례', sections.get('갈등 상황 대응', ''))
    ax_raw = sections.get('AX 혁신 관련 의견', sections.get('AX 혁신 관점', ''))
    flp_raw = sections.get('FLP 프로그램 관련', sections.get('FLP 프로그램', ''))
    english_raw = sections.get('영어 역량', '')
    leisure_raw = sections.get('여가 및 생활', '')

    # 현재 업무 파싱
    job_lines = [l.strip() for l in current_job_raw.splitlines() if l.strip()]
    job_title = ''
    job_bullets = []
    for l in job_lines:
        if l.startswith('**') and l.endswith('**'):
            job_title = l.strip('*')
        elif l.startswith('- '):
            job_bullets.append(l[2:])

    # 주요 성과
    ach = parse_achievement(achievement_raw)

    # 커리어 목표
    goal_items = parse_numbered(career_goals_raw)
    if not goal_items:
        goal_items_html = bullets_html(parse_bullets(career_goals_raw))
    else:
        goal_items_html = ''.join(
            f'<div class="goal-item"><strong>{esc(t)}</strong>'
            + (f'<div class="goal-body">{esc(b)}</div>' if b else '')
            + '</div>'
            for t, b in goal_items
        )

    # 역량 개발 활동 테이블
    skill_rows = parse_table(skills_raw)
    # 영어 역량이 별도 섹션으로 있으면 테이블에 추가
    if english_raw:
        eng_bullets = parse_bullets(english_raw)
        if eng_bullets:
            eng_text = ' '.join(eng_bullets)
            skill_rows.append(('영어 역량', eng_text))

    skills_table_html = ''
    if skill_rows:
        rows_html = ''.join(
            f'<tr><td class="act-name">{esc(a)}</td><td>{bold_md(c)}</td></tr>'
            for a, c in skill_rows
        )
        skills_table_html = f'''
        <table>
          <thead><tr><th>활동</th><th>내용</th></tr></thead>
          <tbody>{rows_html}</tbody>
        </table>'''

    # 갈등 상황 대응
    conflict_bullets = parse_bullets(conflict_raw)

    # AX 혁신
    ax_bullets = parse_bullets(ax_raw)

    # FLP 프로그램
    flp_bullets = parse_bullets(flp_raw)

    # 여가
    leisure_bullets = parse_bullets(leisure_raw)

    # 성과 박스 아이템
    ach_items_html = ''
    for key in ['배경', '역할', '협업', '결과', '의미']:
        val = ach['items'].get(key, '')
        if val:
            ach_items_html += f'<div class="ach-item"><strong>{key}:</strong> {bold_md(val)}</div>'

    # ─── HTML 본문 ───
    html = f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}

  @page {{
    size: A4;
    margin: 0;
  }}

  body {{
    font-family: 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
    font-size: 7.6pt;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}

  .page {{
    width: 210mm;
    height: 297mm;
    position: relative;
    overflow: hidden;
    page-break-after: always;
  }}

  /* ══════════════════════════════════
     헤더 배경 (빨강 그라디언트)
     페이지 전체 너비, 상단~이름까지 커버
  ══════════════════════════════════ */
  .header-bg {{
    background: linear-gradient(180deg, #EF2418 0%, #F33013 100%);
    padding: 11pt 21pt 9pt 21pt;
    color: #fff;
  }}
  .header-top-row {{
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5pt;
  }}
  .header-program {{
    font-size: 8pt;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: #fff;
  }}
  .header-right {{
    display: flex;
    align-items: center;
    gap: 6pt;
  }}
  .badge {{
    background: #000;
    color: #fff;
    font-size: 5.5pt;
    padding: 2pt 5pt;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }}
  .page-num {{
    font-size: 6pt;
    color: #fff;
    min-width: 18pt;
    text-align: right;
  }}
  .name {{
    font-size: 19pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
    color: #fff;
  }}

  /* ── 헤더/메타 구분선 ── */
  .header-sep {{
    height: 0.5pt;
    background: #F1889B;
    margin: 0;
  }}

  /* ── 메타정보 행 ── */
  .meta-row {{
    display: flex;
    gap: 0;
    padding: 6pt 21pt 10pt 21pt;
    background: #fff;
  }}
  .meta-item {{
    padding-right: 16pt;
  }}
  .meta-label {{
    font-size: 5.5pt;
    color: #999;
    display: block;
    margin-bottom: 1.5pt;
  }}
  .meta-value {{
    font-size: 6.8pt;
    color: #222;
    display: block;
  }}

  /* ── 본문 영역 (좌우 패딩) ── */
  .content {{
    padding: 0 21pt;
  }}

  /* ══════════════════════════════════
     섹션 헤더: 왼쪽 수직 그라디언트 바 + 핑크 구분선
  ══════════════════════════════════ */
  .sec-wrap {{
    margin-top: 11pt;
    margin-bottom: 7pt;
  }}
  .sec-wrap:first-child {{
    margin-top: 0;
  }}
  .section-title {{
    position: relative;
    padding: 1pt 0 4pt 8pt;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: -0.01em;
    border-bottom: 0.5pt solid #F1889B;
  }}
  .section-title::before {{
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0.5pt;
    width: 3pt;
    background: linear-gradient(180deg, #E60826 0%, #FC5E1E 100%);
  }}

  /* ── 2컬럼 레이아웃 ── */
  .two-col {{
    display: flex;
    gap: 5pt;
  }}
  .col {{
    flex: 1;
    background: #F7F7F7;
    padding: 7pt 8pt;
    min-height: 55pt;
  }}
  .sub-title {{
    font-size: 6.5pt;
    font-weight: 700;
    margin-bottom: 5pt;
    color: #111;
  }}

  /* ── 불릿 리스트 ── */
  ul {{
    padding-left: 9pt;
    margin: 0;
  }}
  li {{
    font-size: 7.5pt;
    margin-bottom: 2.5pt;
    line-height: 1.35;
  }}
  li:last-child {{ margin-bottom: 0; }}

  /* ── 현재 업무 타이틀 ── */
  .job-title {{
    font-size: 7.8pt;
    font-weight: 700;
    margin-bottom: 4pt;
    line-height: 1.3;
  }}

  /* ══════════════════════════════════
     주요 성과 박스: 아주 연한 분홍 배경
  ══════════════════════════════════ */
  .achievement-box {{
    background: #FFF7F7;
    padding: 8pt 10pt;
    border: 0.5pt solid #F5D0D5;
  }}
  .ach-header {{
    font-size: 7.5pt;
    font-weight: 700;
    color: #E4002B;
    margin-bottom: 4pt;
  }}
  .ach-title {{
    font-size: 7.8pt;
    font-weight: 700;
    color: #111;
    margin-bottom: 5pt;
    line-height: 1.3;
  }}
  .ach-item {{
    font-size: 7.4pt;
    color: #222;
    margin-bottom: 2.5pt;
    line-height: 1.35;
  }}
  .ach-item:last-child {{ margin-bottom: 0; }}

  /* ── 커리어 목표 ── */
  .goals-box {{
    background: #F7F7F7;
    padding: 7pt 10pt;
  }}
  .goal-item {{
    font-size: 7.5pt;
    margin-bottom: 4pt;
    line-height: 1.35;
  }}
  .goal-item:last-child {{ margin-bottom: 0; }}
  .goal-body {{
    font-size: 7.2pt;
    color: #444;
    margin-top: 1.5pt;
    padding-left: 8pt;
  }}

  /* ── 역량 개발 테이블 ── */
  table {{
    width: 100%;
    border-collapse: collapse;
  }}
  thead th {{
    background: #EBEBEB;
    border: 0.5pt solid #CECECE;
    padding: 3.5pt 6pt;
    font-size: 6.8pt;
    font-weight: 700;
    text-align: left;
  }}
  tbody td {{
    border: 0.5pt solid #D8D8D8;
    padding: 3.5pt 6pt;
    font-size: 7.2pt;
    background: #FAFAFA;
    vertical-align: top;
    line-height: 1.35;
  }}
  td.act-name {{
    background: #EFEFEF;
    font-weight: 600;
    white-space: nowrap;
    width: 78pt;
  }}

  /* ── 갈등 상황 박스 ── */
  .gray-box {{
    background: #F7F7F7;
    padding: 7pt 10pt;
  }}

  /* ── 2컬럼 섹션 (AX / FLP) ── */
  .two-col-section {{
    display: flex;
    gap: 14pt;
  }}
  .col-section {{
    flex: 1;
    min-width: 0;
  }}

  /* ── 풋터 ── */
  .footer {{
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 19pt;
    background: #1A1A1A;
    color: #fff;
    font-size: 5.8pt;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 21pt;
  }}

  /* ══════════════════════════════════
     페이지 2 헤더 (작은 빨강 배경 바)
  ══════════════════════════════════ */
  .page2-header-bg {{
    background: linear-gradient(180deg, #EF2418 0%, #F33013 100%);
    padding: 6pt 21pt 5pt 21pt;
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}
  .page2-sk {{
    font-size: 8pt;
    font-weight: 400;
    color: #fff;
  }}
  .page2-name {{
    font-size: 8pt;
    font-weight: 600;
    color: #fff;
    flex: 1;
    text-align: center;
  }}
  .page2-pagenum {{
    font-size: 6pt;
    color: #fff;
  }}

  /* ── 데이터 없음 표시 ── */
  .empty {{ color: #aaa; font-style: italic; font-size: 7pt; }}
</style>
</head>
<body>

<!-- ════════════════ PAGE 1 ════════════════ -->
<div class="page">

  <!-- 빨강 그라디언트 헤더 배경 (이름까지 포함) -->
  <div class="header-bg">
    <div class="header-top-row">
      <span class="header-program">SK · FLP 융합형 인재 육성 프로그램</span>
      <div class="header-right">
        <span class="badge">INTERVIEW SUMMARY</span>
        <span class="page-num">1 / 2</span>
      </div>
    </div>
    <div class="name">{esc(name)}</div>
  </div>

  <!-- 헤더 구분선 -->
  <div class="header-sep"></div>

  <!-- 메타정보 (흰 배경) -->
  <div class="meta-row">
    <div class="meta-item">
      <span class="meta-label">소속</span>
      <span class="meta-value">{esc(affiliation)}&nbsp;|</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">인터뷰</span>
      <span class="meta-value">AI 인터뷰어 Proby</span>
    </div>
    <div class="meta-item">
      <span class="meta-label">형식</span>
      <span class="meta-value">요약 보고서 (2p)</span>
    </div>
  </div>

  <!-- 본문 -->
  <div class="content">

    <!-- 경력 배경 및 현재 업무 -->
    <div class="sec-wrap">
      <div class="section-title">경력 배경 및 현재 업무</div>
    </div>
    <div class="two-col">
      <div class="col">
        <div class="sub-title">경력 배경</div>
        {bullets_html(career_bg) if career_bg else '<span class="empty">데이터 없음</span>'}
      </div>
      <div class="col">
        <div class="sub-title">현재 업무</div>
        {'<div class="job-title">' + esc(job_title) + '</div>' if job_title else ''}
        {bullets_html(job_bullets) if job_bullets else '<span class="empty">데이터 없음</span>'}
      </div>
    </div>

    <!-- 주요 성과 -->
    <div class="sec-wrap">
      <div class="section-title">주요 성과</div>
    </div>
    <div class="achievement-box">
      <div class="ach-header">★&nbsp;핵심 성과</div>
      {'<div class="ach-title">' + bold_md(ach['title']) + '</div>' if ach['title'] else ''}
      {ach_items_html}
    </div>

    <!-- 커리어 목표 -->
    <div class="sec-wrap">
      <div class="section-title">커리어 목표</div>
    </div>
    <div class="goals-box">
      {goal_items_html or bullets_html(parse_bullets(career_goals_raw)) or '<span class="empty">데이터 없음</span>'}
    </div>

    <!-- 역량 개발 활동 -->
    <div class="sec-wrap">
      <div class="section-title">역량 개발 활동</div>
    </div>
    {skills_table_html or '<span class="empty">데이터 없음</span>'}

  </div><!-- /content -->

  <div class="footer">
    <span>SK&nbsp;&nbsp;&nbsp;FLP 융합형 인재 육성 프로그램 · AI 인터뷰어 Proby</span>
    <span>1 / 2</span>
  </div>
</div>

<!-- ════════════════ PAGE 2 ════════════════ -->
<div class="page">

  <!-- 페이지2 작은 빨강 헤더 -->
  <div class="page2-header-bg">
    <span class="page2-sk">SK ·</span>
    <span class="page2-name">{esc(name)}</span>
    <span class="page2-pagenum">2 / 2</span>
  </div>
  <div class="header-sep"></div>

  <!-- 본문 -->
  <div class="content" style="padding-top: 10pt;">

    <!-- 갈등 상황 대응 -->
    <div class="sec-wrap" style="margin-top:0;">
      <div class="section-title">갈등 상황 대응</div>
    </div>
    <div class="gray-box">
      {bullets_html(conflict_bullets) if conflict_bullets else '<span class="empty">데이터 없음</span>'}
    </div>

    <!-- AX 혁신 관점 | FLP 프로그램 -->
    <div class="two-col-section">
      <div class="col-section">
        <div class="sec-wrap">
          <div class="section-title">AX 혁신 관점</div>
        </div>
        {bullets_html(ax_bullets) if ax_bullets else '<span class="empty">데이터 없음</span>'}
      </div>
      <div class="col-section">
        <div class="sec-wrap">
          <div class="section-title">FLP 프로그램</div>
        </div>
        {bullets_html(flp_bullets) if flp_bullets else '<span class="empty">데이터 없음</span>'}
      </div>
    </div>

    <!-- 여가 및 생활 -->
    <div class="sec-wrap">
      <div class="section-title">여가 및 생활</div>
    </div>
    {bullets_html(leisure_bullets) if leisure_bullets else '<span class="empty">데이터 없음</span>'}

  </div><!-- /content -->

  <div class="footer">
    <span>SK&nbsp;&nbsp;&nbsp;FLP 융합형 인재 육성 프로그램 · AI 인터뷰어 Proby</span>
    <span>2 / 2</span>
  </div>
</div>

</body>
</html>'''

    return html


# ───────────────────────────────────────────────────────────
# PDF 렌더링
# ───────────────────────────────────────────────────────────

CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

def render_pdf(html_content, output_path):
    with tempfile.NamedTemporaryFile(suffix='.html', mode='w', encoding='utf-8', delete=False) as f:
        f.write(html_content)
        tmp_html = f.name

    try:
        result = subprocess.run([
            CHROME,
            '--headless=new',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-software-rasterizer',
            f'--print-to-pdf={output_path}',
            '--print-to-pdf-no-header',
            '--no-pdf-header-footer',
            f'file://{tmp_html}',
        ], capture_output=True, text=True, timeout=30)

        if result.returncode != 0:
            print(f'  Chrome error: {result.stderr[:200]}', file=sys.stderr)
            return False
        return True
    finally:
        os.unlink(tmp_html)


# ───────────────────────────────────────────────────────────
# 메인
# ───────────────────────────────────────────────────────────

B_FORMAT_NAMES = [
    '김가영', '김경민', '김선호', '김소혜', '김승완',
    '김찬울', '이건혁', '이준경', '장한솔', '정덕윤',
    '정제욱', '최원석',
]

ALL_NAMES = [
    '강규태', '강혜미', '곽노상', '김가영', '김경민',
    '김선호', '김성연', '김소혜', '김수경', '김승완',
    '김유진', '김찬울', '김한별', '박치홍', '서광수',
    '서진호', '소연홍', '신병철', '심효정', '여두현',
    '여한익', '이건혁', '이승태', '이아미', '이은지',
    '이재영', '이재희', '이준경', '이준희', '이진형',
    '이충헌', '이해솔', '이현준', '임종윤', '장한솔',
    '전한솔', '정덕윤', '정제욱', '조형준', '최원석',
    '최중원', '최지인', '최창순',
]

SUMMARY_DIR = '/Users/churryboy/proby-chris/proby-chris/60. 유저인사이트팀/SKT/인재원 결과/1차 요약'
OUTPUT_DIR  = '/Users/churryboy/proby-chris/proby-chris/60. 유저인사이트팀/SKT/인재원 결과/two-pager'
UPDATE_DIR  = '/Users/churryboy/proby-chris/proby-chris/60. 유저인사이트팀/SKT/인재원 결과/two-pager-update'


def process_one(name, dry_run=False, use_update_dir=False):
    # 마크다운 파일 찾기
    md_path = os.path.join(SUMMARY_DIR, f'{name}_요약.md')
    if not os.path.exists(md_path):
        print(f'  ✗ 마크다운 파일 없음: {md_path}')
        return False

    with open(md_path, encoding='utf-8') as f:
        md_text = f.read()

    sections = parse_markdown(md_text)
    basic = parse_basic_info(sections.get('기본 정보', ''))
    affiliation = basic.get('소속', '')

    html = generate_html(sections, name, affiliation)

    if dry_run:
        out_path = f'/tmp/{name}_test.html'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'  HTML 저장: {out_path}')
        return True

    out_dir = UPDATE_DIR if use_update_dir else OUTPUT_DIR
    output_pdf = os.path.join(out_dir, f'{name}_요약보고서_2p.pdf')
    ok = render_pdf(html, output_pdf)
    if ok:
        print(f'  ✓ {output_pdf}')
    else:
        print(f'  ✗ 렌더링 실패: {name}')
    return ok


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('names', nargs='*', help='변환할 이름 (생략 시 전체 B 형식)')
    parser.add_argument('--dry-run', action='store_true', help='PDF 대신 HTML 저장')
    parser.add_argument('--test', help='단일 테스트 이름')
    parser.add_argument('--all', action='store_true', help='43명 전체를 two-pager-update에 생성')
    args = parser.parse_args()

    use_update = getattr(args, 'all', False)

    if use_update:
        targets = ALL_NAMES
        os.makedirs(UPDATE_DIR, exist_ok=True)
    elif args.test:
        targets = [args.test]
    elif args.names:
        targets = args.names
    else:
        targets = B_FORMAT_NAMES

    print(f'변환 대상: {len(targets)}명')
    success = 0
    for name in targets:
        print(f'처리 중: {name}')
        if process_one(name, dry_run=args.dry_run, use_update_dir=use_update):
            success += 1

    print(f'\n완료: {success}/{len(targets)}')
