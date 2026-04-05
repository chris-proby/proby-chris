/**
 * Proby 설문 패널 — E2E 스모크 테스트
 * node tests/e2e.js
 *
 * 환경변수:
 *   TEST_BASE_URL   - 테스트 대상 URL (기본: http://localhost:3000)
 *   SUPABASE_URL    - Supabase 프로젝트 URL
 *   SUPABASE_SERVICE_ROLE_KEY - Supabase service_role 키
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function run() {
  console.log(`\n🧪 Proby E2E 테스트 — ${BASE_URL}\n`);

  // ─── 1. 비로그인 공고 조회 ───────────────────────────────────
  console.log('1. 비로그인 공고 조회');
  await test('index.html 200 반환', async () => {
    const res = await fetch(BASE_URL);
    assert(res.ok, `HTTP ${res.status}`);
  });

  await test('index.html에 app-view 포함', async () => {
    const res = await fetch(BASE_URL);
    const html = await res.text();
    assert(html.includes('app-view'), 'app-view 없음');
  });

  // ─── 2. 로그인 API ────────────────────────────────────────────
  console.log('\n2. 로그인 API');
  await test('잘못된 이메일로 로그인 시 401', async () => {
    const { res } = await fetchJSON('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nonexistent@proby.io', password: 'wrong' }),
    });
    assert(res.status === 401, `기대 401, 실제 ${res.status}`);
  });

  await test('필드 누락 시 400', async () => {
    const { res } = await fetchJSON('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' }),
    });
    assert(res.status === 400, `기대 400, 실제 ${res.status}`);
  });

  // ─── 3. 세션 API ─────────────────────────────────────────────
  console.log('\n3. 세션 API');
  await test('쿠키 없이 /api/auth/session 접근 시 401', async () => {
    const { res } = await fetchJSON('/api/auth/session');
    assert(res.status === 401, `기대 401, 실제 ${res.status}`);
  });

  // ─── 4. SMS API ───────────────────────────────────────────────
  console.log('\n4. SMS API');
  await test('잘못된 번호로 SMS 발송 시 400', async () => {
    const { res } = await fetchJSON('/api/sms/send', {
      method: 'POST',
      body: JSON.stringify({ phone: '123' }),
    });
    assert(res.status === 400, `기대 400, 실제 ${res.status}`);
  });

  await test('인증번호 없이 SMS 검증 시 400', async () => {
    const { res } = await fetchJSON('/api/sms/verify', {
      method: 'POST',
      body: JSON.stringify({ phone: '01012345678' }),
    });
    assert(res.status === 400, `기대 400, 실제 ${res.status}`);
  });

  // ─── 결과 ─────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`결과: ${passed} 통과 / ${failed} 실패`);
  if (failed > 0) {
    console.error('❌ 테스트 실패 — 배포를 중단합니다.');
    process.exit(1);
  } else {
    console.log('✅ 모든 테스트 통과');
  }
}

run().catch(err => {
  console.error('테스트 실행 오류:', err);
  process.exit(1);
});
