/**
 * D13 — localStorage 백필 마이그레이션
 * 브라우저 콘솔에서 직접 실행하거나, 앱 초기화 시 1회 실행.
 *
 * 목적: 이전에 localStorage에만 저장된 유저·완료이력을 Supabase로 백필.
 * 마이그레이션 완료 후 'sp_migrated_v1' 플래그를 저장해 재실행 방지.
 *
 * 사용법 (브라우저 콘솔):
 *   fetch('/scripts/migrate-localstorage.js').then(r=>r.text()).then(eval)
 */

(async function migrateLocalStorage() {
  const MIGRATION_FLAG = 'sp_migrated_v1';
  const SUPABASE_URL = 'https://ajfavivtgiawmfgxytxg.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pBVR1hpoGX6ZbBw0JzaVJw_GPU7Uhbt';

  if (localStorage.getItem(MIGRATION_FLAG)) {
    console.log('[migrate] 이미 마이그레이션 완료. 건너뜁니다.');
    return;
  }

  const headers = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    'Content-Type': 'application/json',
  };

  function getStore(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }

  let migratedUsers = 0;

  // ─── 유저 백필 ────────────────────────────────────────────────
  const users = getStore('sp_users');
  if (Array.isArray(users) && users.length > 0) {
    console.log(`[migrate] 유저 ${users.length}명 백필 시작...`);
    for (const u of users) {
      if (!u.email) continue;
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/panel_users`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify([{
            email: u.email,
            name: u.name || '',
            password: u.password || '',
            phone: u.phone || '',
            phone_verified: Boolean(u.phoneVerified),
            email_notice_agreed: Boolean(u.emailNoticeAgreed),
            created_at: u.createdAt || new Date().toISOString(),
            bank_name: u.bankName || '',
            bank_account: u.bankAccount || '',
            birthdate: u.birthdate || '',
            gender: u.gender || '',
            job: u.job || '',
          }]),
        });
        if (res.ok || res.status === 409) {
          migratedUsers++;
          console.log(`  ✅ ${u.email}`);
        } else {
          console.warn(`  ⚠️ ${u.email}: HTTP ${res.status}`);
        }
      } catch (e) {
        console.error(`  ❌ ${u.email}: ${e.message}`);
      }
    }
    console.log(`[migrate] 유저 백필 완료: ${migratedUsers}/${users.length}`);
  } else {
    console.log('[migrate] 백필할 로컬 유저 없음.');
  }

  // 마이그레이션 플래그 저장
  localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
  console.log('[migrate] 완료. sp_migrated_v1 플래그 저장됨.');
})();
