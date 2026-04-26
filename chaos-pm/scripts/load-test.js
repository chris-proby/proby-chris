// chaos-pm load test (k6)
//
// Usage:
//   brew install k6                     # one-time
//   k6 run scripts/load-test.js         # default 50 vu × 1 min
//   k6 run -e BASE=https://chaos-pm.vercel.app scripts/load-test.js
//   k6 run -e SCENARIO=spike scripts/load-test.js
//
// Exits non-zero if SLOs are breached.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.BASE || 'https://chaos-pm.vercel.app';
const SCENARIO = __ENV.SCENARIO || 'baseline';

// ── Scenarios ──────────────────────────────────────────────
const scenarios = {
  baseline: {
    executor: 'constant-vus',
    vus: 50,
    duration: '1m',
  },
  ramp: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 50 },
      { duration: '1m',  target: 200 },
      { duration: '1m',  target: 500 },
      { duration: '30s', target: 0 },
    ],
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: 1000 },
      { duration: '30s', target: 1000 },
      { duration: '10s', target: 0 },
    ],
  },
};

const errorRate = new Rate('app_errors');

export const options = {
  scenarios: { [SCENARIO]: scenarios[SCENARIO] },
  thresholds: {
    // SLOs — load test fails if breached
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.01'],          // < 1% failure
    app_errors: ['rate<0.05'],               // < 5% app-level errors
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

// ── Test scenarios (anonymous endpoints only — auth load test
// requires real Supabase JWTs which we'd need to provision separately)
export default function () {
  // 1. Homepage load (HTML + critical chunks)
  const homepageRes = http.get(`${BASE}/`);
  check(homepageRes, {
    'homepage 200': (r) => r.status === 200,
    'homepage < 1s': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1);

  // 2. API gating — should return 401 fast (no DB roundtrip)
  const authProbe = http.post(
    `${BASE}/api/liveblocks-auth`,
    JSON.stringify({ room: 'load-test' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(authProbe, {
    'auth probe 401': (r) => r.status === 401,
    'auth probe < 500ms': (r) => r.timings.duration < 500,
  }) || errorRate.add(1);

  // 3. Snapshot endpoint also gated
  const snapshotProbe = http.get(`${BASE}/api/canvas/snapshot?room_id=load-test`);
  check(snapshotProbe, {
    'snapshot probe 401': (r) => r.status === 401,
  }) || errorRate.add(1);

  sleep(Math.random() * 2 + 1); // 1-3s think time
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration.values['p(95)'];
  const failRate = data.metrics.http_req_failed.values.rate;
  const totalReqs = data.metrics.http_reqs.values.count;

  console.log(`\n────────────────────────────────────────`);
  console.log(`📊 chaos-pm load test summary (${SCENARIO})`);
  console.log(`   Total requests : ${totalReqs}`);
  console.log(`   p95 latency    : ${p95.toFixed(0)}ms`);
  console.log(`   Failure rate   : ${(failRate * 100).toFixed(2)}%`);
  console.log(`────────────────────────────────────────\n`);

  return { stdout: '' }; // suppress default verbose output
}
