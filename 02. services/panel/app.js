/* ═══════════════════════════════════════════════════
   Proby 설문 패널 — Application Logic
   ═══════════════════════════════════════════════════ */

// ─── EmailJS Configuration ───
// 1. https://www.emailjs.com 에서 무료 계정 생성
// 2. Email Service 연결 (Gmail 등)
// 3. Template 생성 (변수: from_name, from_email, phone, bank_name, bank_account, amount, message)
// 4. 아래 값을 실제 키로 교체
const EMAIL_CONFIG = {
  serviceId: '',
  templateId: '',
  publicKey: '',
  recipientEmail: 'chris@proby.io',
};

// 관리자 이메일 — 이 계정으로 로그인 시 "유저 조회" 탭이 표시됩니다.
const ADMIN_EMAIL = 'chris@proby.io';

// ─── Supabase Configuration (public values) ───
const SUPABASE_URL = 'https://ajfavivtgiawmfgxytxg.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_pBVR1hpoGX6ZbBw0JzaVJw_GPU7Uhbt';
let supabaseClient = null;
const SUPABASE_REST_BASE = `${SUPABASE_URL}/rest/v1`;

function isAdmin() {
  return state.currentUser && state.currentUser.email === ADMIN_EMAIL;
}

function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (!window.supabase || !window.supabase.createClient) return null;
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return supabaseClient;
}

function getSupabaseHeaders() {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

function userToRow(user) {
  return {
    email: user.email,
    name: user.name || '',
    password: user.password || '',
    phone: user.phone || '',
    phone_verified: Boolean(user.phoneVerified),
    email_notice_agreed: Boolean(user.emailNoticeAgreed),
    created_at: user.createdAt || new Date().toISOString(),
    bank_name: user.bankName || '',
    bank_account: user.bankAccount || '',
    birthdate: user.birthdate || '',
    gender: user.gender || '',
    job: user.job || '',
    updated_at: new Date().toISOString(),
  };
}

function rowToUser(row) {
  return {
    email: row.email,
    name: row.name || '',
    password: row.password || '',
    phone: row.phone || '',
    phoneVerified: Boolean(row.phone_verified),
    emailNoticeAgreed: Boolean(row.email_notice_agreed),
    createdAt: row.created_at || new Date().toISOString(),
    bankName: row.bank_name || '',
    bankAccount: row.bank_account || '',
    birthdate: row.birthdate || '',
    gender: row.gender || '',
    job: row.job || '',
  };
}

function listingToRow(listing) {
  return {
    id: listing.id,
    title: listing.title || '',
    description: listing.description || '',
    reward: listing.reward || 0,
    survey_link: listing.surveyLink || '',
    deadline: listing.deadline || '',
    status: listing.status || 'active',
    category: listing.category || '',
    estimated_time: listing.estimatedTime || '',
    max_participants: listing.maxParticipants || 0,
    current_participants: listing.currentParticipants || 0,
    participant_genders: JSON.stringify(listing.participantGenders || []),
    participant_age_ranges: JSON.stringify(listing.participantAgeRanges || []),
    participant_devices: JSON.stringify(listing.participantDevices || []),
  };
}

function parseListingJsonArray(val, fallback = []) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    try {
      const p = JSON.parse(val);
      return Array.isArray(p) ? p : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function rowToListing(row) {
  const ageRaw = parseListingJsonArray(row.participant_age_ranges, []);
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    reward: row.reward || 0,
    surveyLink: row.survey_link || '',
    deadline: row.deadline || '',
    status: row.status || 'active',
    category: row.category || '',
    estimatedTime: row.estimated_time || '',
    maxParticipants: row.max_participants || 0,
    currentParticipants: row.current_participants || 0,
    participantGenders: parseListingJsonArray(row.participant_genders, []),
    participantAgeRanges: ageRaw.map(Number).filter(n => [10, 20, 30, 40, 50, 60].includes(n)),
    participantDevices: parseListingJsonArray(row.participant_devices, []),
  };
}

async function syncUsersFromSupabase() {
  try {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('panel_users')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) {
        setStore(KEYS.users, (data || []).map(rowToUser));
        return true;
      }
      console.warn('[supabase] users sync sdk failed:', error.message);
    }

    // SDK 로드 실패/차단 대비 REST 폴백
    const res = await fetch(`${SUPABASE_REST_BASE}/panel_users?select=*&order=created_at.desc`, {
      method: 'GET',
      headers: getSupabaseHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[supabase] users sync rest failed:', res.status, text);
      return false;
    }
    const data = await res.json();
    setStore(KEYS.users, (data || []).map(rowToUser));
    return true;
  } catch (err) {
    console.warn('[supabase] users sync failed:', err?.message || err);
    return false;
  }
}

async function upsertUserToSupabase(user) {
  if (!user?.email) return false;
  const row = userToRow(user);
  try {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client
        .from('panel_users')
        .upsert(row, { onConflict: 'email' });
      if (!error) return true;
      console.warn('[supabase] users upsert sdk failed:', error.message);
    }

    // SDK 로드 실패/차단 대비 REST 폴백
    const res = await fetch(`${SUPABASE_REST_BASE}/panel_users`, {
      method: 'POST',
      headers: {
        ...getSupabaseHeaders(),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify([row]),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[supabase] users upsert rest failed:', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[supabase] users upsert failed:', err?.message || err);
    return false;
  }
}

async function syncListingsFromSupabase() {
  try {
    const client = getSupabaseClient();
    let rows = null;
    if (client) {
      const { data, error } = await client
        .from('panel_listings')
        .select('*')
        .order('id', { ascending: false });
      if (!error) rows = data;
      else console.warn('[supabase] listings sync sdk failed:', error.message);
    }
    if (rows === null) {
      const res = await fetch(`${SUPABASE_REST_BASE}/panel_listings?select=*&order=id.desc`, {
        headers: getSupabaseHeaders(),
      });
      if (res.ok) rows = await res.json();
      else console.warn('[supabase] listings sync rest failed:', res.status);
    }

    if (rows && rows.length > 0) {
      // 로컬에 저장된 participant 필드를 보존하기 위해 기존 localStorage 값을 먼저 읽어둠
      const localListings = getStore(KEYS.listings, []);
      const localById = new Map();
      localListings.forEach(l => {
        localById.set(l.id, l);
        localById.set(Number(l.id), l);
      });

      const byId = new Map(rows.map(r => {
        const fromDb = rowToListing(r);
        const local = localById.get(r.id) || localById.get(Number(r.id)) || {};
        // DB에 participant 컬럼이 없을 경우(빈 배열) 로컬 값으로 보완
        if (!fromDb.participantGenders.length && local.participantGenders?.length) fromDb.participantGenders = local.participantGenders;
        if (!fromDb.participantAgeRanges.length && local.participantAgeRanges?.length) fromDb.participantAgeRanges = local.participantAgeRanges;
        if (!fromDb.participantDevices.length && local.participantDevices?.length) fromDb.participantDevices = local.participantDevices;
        // current_participants: 클라이언트 upsert가 RLS로 실패하는 경우가 많아, 로컬에서 올린 값이 DB(0)로 덮이지 않게 병합
        const dbCp = Number(fromDb.currentParticipants) || 0;
        const localCp = Number(local.currentParticipants) || 0;
        fromDb.currentParticipants = Math.max(dbCp, localCp);
        return [r.id, fromDb];
      }));
      SAMPLE_LISTINGS.forEach(sample => {
        const existing = byId.get(sample.id);
        if (existing) {
          // sample의 participant 기본값은 existing이 빈 배열일 때만 보완
          const merged = { ...sample, ...existing };
          if (!existing.participantGenders.length) merged.participantGenders = sample.participantGenders || [];
          if (!existing.participantAgeRanges.length) merged.participantAgeRanges = sample.participantAgeRanges || [];
          if (!existing.participantDevices.length) merged.participantDevices = sample.participantDevices || [];
          byId.set(sample.id, merged);
        } else {
          byId.set(sample.id, sample);
        }
      });
      const merged = [...byId.values()];
      setStore(KEYS.listings, merged);

      // Supabase에 없는 샘플 ID만 초기 시드 (기존 운영 데이터 덮어쓰기 방지)
      const existingIds = new Set((rows || []).map(r => Number(r.id)));
      const missingSamples = SAMPLE_LISTINGS.filter(sample => !existingIds.has(Number(sample.id)));
      if (missingSamples.length > 0) {
        upsertListingsToSupabase(missingSamples).catch(() => {});
      }
    } else {
      setStore(KEYS.listings, SAMPLE_LISTINGS);
      upsertListingsToSupabase(SAMPLE_LISTINGS).catch(() => {});
    }
    return true;
  } catch (err) {
    console.warn('[supabase] listings sync failed:', err?.message || err);
    return false;
  }
}

async function upsertListingsToSupabase(listings) {
  if (!listings || listings.length === 0) return false;
  const rows = listings.map(listingToRow);
  try {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client
        .from('panel_listings')
        .upsert(rows, { onConflict: 'id' });
      if (!error) return true;
      console.warn('[supabase] listings upsert sdk failed:', error.message);
    }
    const res = await fetch(`${SUPABASE_REST_BASE}/panel_listings`, {
      method: 'POST',
      headers: { ...getSupabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[supabase] listings upsert rest failed:', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[supabase] listings upsert failed:', err?.message || err);
    return false;
  }
}

async function upsertListingToSupabase(listing) {
  return upsertListingsToSupabase([listing]);
}

async function deleteUserFromSupabase(email) {
  if (!email) return false;
  try {
    const client = getSupabaseClient();
    if (client) {
      const { error } = await client
        .from('panel_users')
        .delete()
        .eq('email', email);
      if (!error) return true;
      console.warn('[supabase] users delete sdk failed:', error.message);
    }

    const res = await fetch(`${SUPABASE_REST_BASE}/panel_users?email=eq.${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: getSupabaseHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[supabase] users delete rest failed:', res.status, text);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[supabase] users delete failed:', err?.message || err);
    return false;
  }
}

// ─── Sample Data ───
const SAMPLE_LISTINGS = [
  {
    id: 1,
    title: '2026 MZ세대 금융 생활 실태조사',
    description: '20~30대의 금융 생활 패턴과 은행 서비스 이용 행태를 파악하기 위한 설문조사입니다. 주 거래 은행, 모바일 뱅킹 이용 빈도, 투자·저축 습관 등에 대한 질문으로 구성되어 있습니다.',
    reward: 5000,
    surveyLink: 'https://forms.gle/example1',
    deadline: '2026-03-15',
    status: 'closed',
    category: '금융',
    estimatedTime: '15분',
    maxParticipants: 100,
    currentParticipants: 100,
  },
  {
    id: 2,
    title: '외식 브랜드 인지도 및 선호도 조사',
    description: '국내 주요 외식 브랜드에 대한 인지도, 방문 빈도, 메뉴 선호도를 조사합니다. 최근 3개월 내 외식 경험이 있는 분이라면 누구나 참여 가능합니다.',
    reward: 3000,
    surveyLink: 'https://forms.gle/example2',
    deadline: '2026-03-10',
    status: 'closed',
    category: '외식·F&B',
    estimatedTime: '10분',
    maxParticipants: 80,
    currentParticipants: 80,
  },
  {
    id: 3,
    title: '자동차 구매 경험 심층 설문',
    description: '최근 2년 내 자동차를 구매하신 분들을 대상으로, 구매 과정에서의 정보 탐색 경로, 딜러십 경험, 브랜드 선택 요인 등을 심층적으로 파악합니다.',
    reward: 8000,
    surveyLink: 'https://forms.gle/example3',
    deadline: '2026-03-01',
    status: 'closed',
    category: '자동차',
    estimatedTime: '20분',
    maxParticipants: 50,
    currentParticipants: 50,
  },
  {
    id: 4,
    title: '재택근무 만족도 및 생산성 조사',
    description: '재택근무 또는 하이브리드 근무를 경험한 직장인을 대상으로, 업무 환경 만족도와 생산성 변화를 조사합니다.',
    reward: 4000,
    surveyLink: 'https://forms.gle/example4',
    deadline: '2026-02-20',
    status: 'closed',
    category: '근무환경',
    estimatedTime: '12분',
    maxParticipants: 60,
    currentParticipants: 60,
  },
  {
    id: 5,
    title: '디지털 헬스케어 앱 사용 경험 조사',
    description: '건강 관리 앱, 운동 기록 앱, 식단 관리 앱 등 디지털 헬스케어 서비스 이용 현황과 만족도를 파악합니다.',
    reward: 3500,
    surveyLink: 'https://forms.gle/example5',
    deadline: '2026-03-02',
    status: 'closed',
    category: '헬스케어',
    estimatedTime: '8분',
    maxParticipants: 70,
    currentParticipants: 70,
  },
  {
    id: 6,
    title: 'OTT 서비스 이용 패턴 조사',
    description: '넷플릭스, 웨이브, 쿠팡플레이 등 OTT 서비스 이용 행태와 콘텐츠 소비 패턴을 파악하는 설문입니다.',
    reward: 4500,
    surveyLink: 'https://forms.gle/example6',
    deadline: '2026-02-30',
    status: 'closed',
    category: '미디어·콘텐츠',
    estimatedTime: '15분',
    maxParticipants: 90,
    currentParticipants: 90,
  },
  {
    id: 8,
    title: 'AI 인터뷰어와의 대화 경험 평가 조사',
    description: 'AI와 인터뷰를 하는 경험에 대한 인식 탐구',
    reward: 1000,
    surveyLink: 'https://www.proby.io/interview?t=4tpUwos0',
    deadline: '2026-12-31',
    status: 'active',
    category: 'AI',
    estimatedTime: '3~5분',
    maxParticipants: 100,
    currentParticipants: 0,
  },
  {
    id: 10,
    title: '전기밥솥 브랜드 인지도 조사',
    description: '전기밥솥 브랜드에 대한 인지도와 어떤 이유로 선호하는지 등을 파악하기 위해 기획된 조사입니다',
    reward: 1000,
    surveyLink: 'https://www.proby.io/interview?t=8ai1hGiN',
    deadline: '2026-03-29',
    status: 'active',
    category: '가전',
    estimatedTime: '3~5분',
    maxParticipants: 10,
    currentParticipants: 0,
  },

  {
    id: 9,
    title: '뱅킹 앱 디자인 평가 조사',
    description: '뱅킹 앱을 사용하실 때, 더 선호하는 디자인이 무엇인지를 이해하기 위해 기획된 조사입니다',
    reward: 5000,
    surveyLink: 'https://www.proby.io/interview?t=1Fw2FPzQT',
    deadline: '2026-03-24',
    status: 'active',
    category: '금융',
    estimatedTime: '15~20분',
    maxParticipants: 5,
    currentParticipants: 0,
  },
].map(l => ({
  participantGenders: ['male', 'female'],
  participantAgeRanges: [20, 30, 40, 50],
  participantDevices: ['pc', 'mobile'],
  ...l,
}));

// ─── State ───
const state = {
  currentUser: null,
  currentTab: 'listings',
  currentListing: null,
  searchQuery: '',
  authMode: 'login',
};

/** 정산 탭 계좌 입력란 자동 저장 디바운스 */
let bankInfoAutosaveTimer = null;

// ─── Storage Keys ───
const KEYS = {
  users: 'sp_users',
  session: 'sp_session',        // 서명된 세션 토큰 (JWT 형식)
  sessionUser: 'sp_session_user', // 세션 유저 캐시 (비밀번호 제외)
  listings: 'sp_listings',
  completed: 'sp_completed',
  payouts: 'sp_payouts',
  settlementCompleted: 'sp_settlement_completed',
};

// ─── Storage Helpers ───
function getStore(key, fallback = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function setStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ─── Mixpanel: 설문 참여 클릭 로깅 (SDK 실패 시 Track API 폴백) ───
var MIXPANEL_TOKEN = typeof window !== 'undefined' && window.MIXPANEL_TOKEN ? window.MIXPANEL_TOKEN : '1a30b5a4b298ee5477f21dc2a26e2307';
var ENTRY_ATTR_KEY = 'sp_entry_attribution_v1';
var LANDING_TRACKED_KEY = 'sp_landing_tracked_v1';

function inferSourceFromReferrer(referrer) {
  if (!referrer) return 'direct';
  var r = String(referrer).toLowerCase();
  try {
    var u = new URL(referrer);
    var host = u.hostname.replace(/^www\./, '');
    // Gmail 웹앱에서 직접 넘어온 경우(드묾)
    if (host === 'mail.google.com' || host === 'inbox.google.com') return 'gmail';
    // Gmail/검색 등에서 흔한 Google 래퍼 링크 (이메일·광고·검색 구분 불가)
    if (host === 'google.com' && u.pathname.indexOf('/url') === 0) return 'google_redirect';
  } catch (e) {}
  if (r.includes('kakao')) return 'kakao';
  if (r.includes('linkedin')) return 'linkedin';
  if (r.includes('google')) return 'google';
  if (r.includes('naver')) return 'naver';
  if (r.includes('instagram')) return 'instagram';
  if (r.includes('facebook')) return 'facebook';
  if (r.includes('t.co') || r.includes('twitter')) return 'twitter';
  try {
    return new URL(referrer).hostname || 'referral';
  } catch {
    return 'referral';
  }
}

function getTrafficProps() {
  try {
    var url = new URL(window.location.href);
    var utmSource = url.searchParams.get('utm_source') || '';
    var utmMedium = url.searchParams.get('utm_medium') || '';
    var utmCampaign = url.searchParams.get('utm_campaign') || '';
    var utmContent = url.searchParams.get('utm_content') || '';
    var utmTerm = url.searchParams.get('utm_term') || '';
    var referrer = document.referrer || '';
    // Gmail·메일앱·일부 브라우저는 Referer를 보내지 않음 → 클라이언트만으로는 'direct'로 보일 수 있음
    var referrerPresent = Boolean(referrer && referrer.length > 0);
    var currentSource = utmSource || inferSourceFromReferrer(referrer);

    var firstTouch = getStore(ENTRY_ATTR_KEY, null);
    if (!firstTouch) {
      firstTouch = {
        first_source: currentSource || 'direct',
        first_referrer: referrer || '',
        first_landing_path: url.pathname + url.search,
        first_seen_at: new Date().toISOString(),
      };
      setStore(ENTRY_ATTR_KEY, firstTouch);
    }

    return {
      entry_source: currentSource || 'direct',
      referrer: referrer || '',
      referrer_present: referrerPresent,
      landing_path: url.pathname + url.search,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      first_touch_source: firstTouch.first_source || '',
      first_touch_referrer: firstTouch.first_referrer || '',
      first_touch_landing_path: firstTouch.first_landing_path || '',
    };
  } catch (e) {
    return { entry_source: 'direct' };
  }
}

function getDistinctId() {
  if (typeof state !== 'undefined' && state.currentUser && state.currentUser.name) {
    var name = String(state.currentUser.name).trim();
    if (name) return name;
  }
  try {
    var key = 'sp_mixpanel_distinct_id';
    var id = localStorage.getItem(key);
    if (!id) {
      id = 'anon_' + Math.random().toString(36).slice(2) + '_' + Date.now();
      localStorage.setItem(key, id);
    }
    return id;
  } catch (e) {
    return 'anon_' + Date.now();
  }
}

function sendMixpanelEvent(eventName, props) {
  var distinctId = getDistinctId();
  var traffic = getTrafficProps();
  var mergedProps = {};
  for (var t in traffic) mergedProps[t] = traffic[t];
  for (var p in (props || {})) mergedProps[p] = props[p];
  if (
    typeof window.mixpanel !== 'undefined' &&
    window.mixpanel.track &&
    window.__mixpanelReady === true
  ) {
    try {
      window.mixpanel.identify(distinctId);
      window.mixpanel.track(eventName, mergedProps);
    } catch (e) {}
  }
  try {
    var event = {
      event: eventName,
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: distinctId,
        time: Math.floor(Date.now() / 1000),
      },
    };
    for (var k in mergedProps) event.properties[k] = mergedProps[k];
    var data = btoa(unescape(encodeURIComponent(JSON.stringify([event]))));
    fetch('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(data),
    }).catch(function () {});
  } catch (e) {}
}

function safeMixpanelIdentify(nameOrId) {
  if (!nameOrId) return;
  if (
    typeof window.mixpanel !== 'undefined' &&
    window.mixpanel &&
    typeof window.mixpanel.identify === 'function' &&
    window.__mixpanelReady === true
  ) {
    try {
      window.mixpanel.identify(String(nameOrId).trim());
    } catch (e) {}
  }
}

function trackLandingViewedOnce() {
  try {
    if (sessionStorage.getItem(LANDING_TRACKED_KEY) === '1') return;
    sessionStorage.setItem(LANDING_TRACKED_KEY, '1');
  } catch (e) {}
  sendMixpanelEvent('랜딩 조회', {
    source: 'page_load',
  });
}

function trackSurveyClick(payload) {
  sendMixpanelEvent('클릭 - ' + (payload.title || '제목 없음'), {
    title: payload.title,
    listing_id: payload.listing_id,
    category: payload.category || '',
    source: payload.source || 'card',
  });
}

function trackUserSignup(payload) {
  sendMixpanelEvent('회원가입 완료', {
    email: payload.email || '',
    name: payload.name || '',
    phone_last4: payload.phone_last4 || '',
    source: payload.source || 'register_form',
  });
}

/** 관리자가 조사 추가 모달로 새 공고를 생성했을 때 */
function trackListingCreated(listing) {
  if (!listing) return;
  sendMixpanelEvent('조사 생성 - ' + (listing.title || '제목 없음'), {
    title: listing.title,
    listing_id: listing.id,
    category: listing.category || '',
    deadline: listing.deadline || '',
    max_participants: listing.maxParticipants,
    estimated_time: listing.estimatedTime || '',
    participant_genders: (listing.participantGenders || []).join(','),
    participant_age_ranges: (listing.participantAgeRanges || []).join(','),
    participant_devices: (listing.participantDevices || []).join(','),
    source: 'admin_create',
  });
}

// ─── Data Initialization ───
function initData() {
  const stored = getStore(KEYS.listings);
  if (!stored || stored.length === 0) {
    setStore(KEYS.listings, SAMPLE_LISTINGS);
  } else {
    const byId = new Map(stored.map(l => [l.id, l]));
    SAMPLE_LISTINGS.forEach(sample => {
      const existing = byId.get(sample.id);
      // 로컬 저장값(수정 데이터)을 우선 유지하고 샘플은 누락 필드만 채움
      byId.set(sample.id, existing ? { ...sample, ...existing } : sample);
    });
    setStore(KEYS.listings, [...byId.values()]);
  }
  if (!getStore(KEYS.users)) {
    setStore(KEYS.users, []);
  }
  if (!getStore(KEYS.completed)) {
    setStore(KEYS.completed, []);
  }
  if (!getStore(KEYS.payouts)) {
    setStore(KEYS.payouts, []);
  }
  if (!getStore(KEYS.settlementCompleted)) {
    setStore(KEYS.settlementCompleted, []);
  }
}

// ─── Auth ───
function getUsers() { return getStore(KEYS.users, []); }

function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

function findUser(email) {
  return getUsers().find(u => u.email === email);
}

/** 로그인 세션의 최신 값이 panel_users 캐시보다 우선 (계좌 등 저장 직후 UI 일치) */
function getMergedCurrentUser() {
  if (!state.currentUser?.email) return null;
  const fromList = findUser(state.currentUser.email);
  return fromList ? { ...fromList, ...state.currentUser } : { ...state.currentUser };
}

function patchLocalUserByEmail(email, patch) {
  if (!email || !patch) return;
  const users = getUsers();
  const idx = users.findIndex(u => u.email === email);
  let next;
  if (idx >= 0) {
    next = users.slice();
    next[idx] = { ...next[idx], ...patch };
  } else if (state.currentUser?.email === email) {
    next = [...users, { ...state.currentUser, ...patch }];
  } else {
    return;
  }
  setStore(KEYS.users, next);
}

function findUserByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return getUsers().find(u => normalizePhone(u.phone) === normalized);
}

function parseJsonBody(res) {
  return res
    .json()
    .then((j) => (j && typeof j === 'object' ? j : {}))
    .catch(() => ({}));
}

async function sendEmailVerificationCode(email) {
  if (!email || !email.includes('@')) return { ok: false, error: '올바른 이메일 주소를 입력하세요.' };
  try {
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
    const data = await parseJsonBody(res);
    if (!res.ok || !data.ok) {
      const msg =
        typeof data.error === 'string' && data.error.trim()
          ? data.error
          : '인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.';
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: '네트워크 오류로 인증번호 발송에 실패했습니다.' };
  }
}

async function verifyEmailCode(email, inputCode) {
  const code = (inputCode || '').trim();
  if (!email || !code) return { ok: false, error: '이메일과 인증번호를 입력하세요.' };
  try {
    const res = await fetch('/api/email/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase(), code }),
    });
    const data = await parseJsonBody(res);
    if (!res.ok || !data.ok) {
      const msg =
        typeof data.error === 'string' && data.error.trim()
          ? data.error
          : '인증번호가 올바르지 않습니다.';
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: '네트워크 오류가 발생했습니다.' };
  }
}

async function register(name, email, password, phone, verificationCode) {
  // 이메일 인증 임시 비활성화 — verificationCode 있을 때만 검증
  if (verificationCode) {
    const verifyResult = await verifyEmailCode(email, verificationCode);
    if (!verifyResult.ok) {
      return { ok: false, error: verifyResult.error };
    }
  }
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return { ok: false, error: data.error || '회원가입에 실패했습니다.' };
    trackUserSignup({
      email,
      name,
      phone_last4: String(phone).replace(/\D/g, '').slice(-4),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: '네트워크 오류가 발생했습니다.' };
  }
}

async function deleteUser(email) {
  const users = getUsers().filter(u => u.email !== email);
  setStore(KEYS.users, users);
  await deleteUserFromSupabase(email);
  await syncUsersFromSupabase();
}

async function updateUserProfile(email, fields) {
  if (!email || !fields) return false;
  const row = { updated_at: new Date().toISOString() };
  if (fields.name      !== undefined) row.name         = fields.name;
  if (fields.birthdate !== undefined) row.birthdate     = fields.birthdate;
  if (fields.gender    !== undefined) row.gender        = fields.gender;
  if (fields.job       !== undefined) row.job           = fields.job;
  if (fields.bankName  !== undefined) row.bank_name     = fields.bankName;
  if (fields.bankAccount !== undefined) row.bank_account = fields.bankAccount;
  try {
    const res = await fetch(
      `${SUPABASE_REST_BASE}/panel_users?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: { ...getSupabaseHeaders(), Prefer: 'return=minimal' },
        body: JSON.stringify(row),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function saveBankInfo(bankName, bankAccount) {
  if (!state.currentUser) return;
  state.currentUser.bankName = bankName;
  state.currentUser.bankAccount = bankAccount;
  setStore(KEYS.sessionUser, { ...state.currentUser });
  patchLocalUserByEmail(state.currentUser.email, { bankName, bankAccount });
  await updateUserProfile(state.currentUser.email, { bankName, bankAccount });
}

async function saveProfile(name, birthdate, gender, job) {
  if (!state.currentUser) return;
  Object.assign(state.currentUser, { name, birthdate, gender, job });
  setStore(KEYS.sessionUser, { ...state.currentUser });
  document.getElementById('header-user-name').textContent = name;
  safeMixpanelIdentify(name);
  await updateUserProfile(state.currentUser.email, { name, birthdate, gender, job });
}

async function login(email, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return { ok: false, error: data.error || '로그인에 실패했습니다.' };

    setStore(KEYS.session, data.token);
    setStore(KEYS.sessionUser, data.user);
    state.currentUser = data.user;
    safeMixpanelIdentify(data.user && data.user.name);
    // 다른 기기에서 참여한 이력을 복원
    syncCompletedFromSupabase().catch(() => {});
    return { ok: true };
  } catch (e) {
    return { ok: false, error: '네트워크 오류가 발생했습니다.' };
  }
}

function logout() {
  localStorage.removeItem(KEYS.session);
  localStorage.removeItem(KEYS.sessionUser);
  state.currentUser = null;
  // 로그아웃 후에도 공고는 열람 가능해야 함
  showView('app');
}

function checkSession() {
  const token = getStore(KEYS.session);
  const user  = getStore(KEYS.sessionUser);
  if (!token || !user || !user.email) return false;
  try {
    // 토큰의 페이로드 부분(첫 번째 segment)만 디코딩해 만료 확인
    const [dataB64] = token.split('.');
    const payload = JSON.parse(atob(dataB64));
    if (!payload.email || payload.exp < Date.now()) {
      localStorage.removeItem(KEYS.session);
      localStorage.removeItem(KEYS.sessionUser);
      return false;
    }
    state.currentUser = user;
    safeMixpanelIdentify(user && user.name);
    return true;
  } catch {
    localStorage.removeItem(KEYS.session);
    localStorage.removeItem(KEYS.sessionUser);
    return false;
  }
}

// ─── 참여 조건 (카드 푸터 · 상세 · 어드민) ───
const PART_GENDER_LABELS = { male: '남자', female: '여자' };
const PART_DEVICE_LABELS = { pc: 'PC', mobile: '핸드폰' };
const PART_AGE_ORDER = [10, 20, 30, 40, 50, 60];

function enrichListing(l) {
  if (!l) return l;
  return {
    ...l,
    participantGenders: parseListingJsonArray(l.participantGenders, []),
    participantAgeRanges: parseListingJsonArray(l.participantAgeRanges, [])
      .map(Number)
      .filter(n => PART_AGE_ORDER.includes(n)),
    participantDevices: parseListingJsonArray(l.participantDevices, []),
  };
}

function formatParticipantGenders(arr) {
  if (!arr || !arr.length) return '';
  const order = ['male', 'female'];
  const sorted = [...new Set(arr)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return sorted.map(g => PART_GENDER_LABELS[g] || g).join(' · ');
}

function formatParticipantAgeRanges(arr) {
  if (!arr || !arr.length) return '';
  const sorted = [...new Set(arr.map(Number))].filter(n => PART_AGE_ORDER.includes(n)).sort((a, b) => a - b);
  if (!sorted.length) return '';
  const parts = [];
  let s = sorted[0];
  let e = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === e + 10) e = sorted[i];
    else {
      parts.push(s === e ? `${s}대` : `${s}대~${e}대`);
      s = e = sorted[i];
    }
  }
  parts.push(s === e ? `${s}대` : `${s}대~${e}대`);
  return parts.join(', ');
}

function formatParticipantDevices(arr) {
  if (!arr || !arr.length) return '';
  const order = ['pc', 'mobile'];
  const sorted = [...new Set(arr)].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return sorted.map(d => PART_DEVICE_LABELS[d] || d).join(' · ');
}

// 상세 화면용 (기존 inline)
function buildListingConditionsHtml(listing) {
  const g = formatParticipantGenders(listing.participantGenders);
  const a = formatParticipantAgeRanges(listing.participantAgeRanges);
  const d = formatParticipantDevices(listing.participantDevices);
  if (!g && !a && !d) {
    return '<span class="listing-cond-missing">참여 조건 미설정</span>';
  }
  const chunks = [];
  if (g) chunks.push(`<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">wc</span>${escapeHtml(g)}</span>`);
  if (a) chunks.push(`<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">cake</span>${escapeHtml(a)}</span>`);
  if (d) chunks.push(`<span class="flex items-center gap-1"><span class="material-symbols-outlined text-sm">devices</span>${escapeHtml(d)}</span>`);
  return chunks.join('');
}

// 카드 푸터: 3행×2열 (좌: 리워드·소요시간·모집인원 / 우: 성별·연령·기기)
function buildListingFooterTwoColGridHtml(listing) {
  const participants = getListingParticipantCount(listing.id, listing);
  const maxParticipants = Number(listing.maxParticipants) || 0;
  const reward = getListingReward(listing).toLocaleString();
  const timeStr = (listing.estimatedTime && String(listing.estimatedTime).trim()) ? escapeHtml(String(listing.estimatedTime).trim()) : '—';
  const mobStr =
    maxParticipants > 0
      ? `${Math.min(participants, maxParticipants).toLocaleString()}/${maxParticipants.toLocaleString()}명`
      : '—';

  const g = formatParticipantGenders(listing.participantGenders);
  const a = formatParticipantAgeRanges(listing.participantAgeRanges);
  const d = formatParticipantDevices(listing.participantDevices);
  const col2g = g ? escapeHtml(g) : '<span class="listing-cond-missing">—</span>';
  const col2a = a ? escapeHtml(a) : '<span class="listing-cond-missing">—</span>';
  const col2d = d ? escapeHtml(d) : '<span class="listing-cond-missing">—</span>';

  return `
    <div class="listing-card-footer-grid listing-card-footer-grid--3x2">
      <div class="lcf-pair">
        <span class="lcf-pair-label">리워드</span>
        <span class="lcf-pair-value lcf-pair-value--reward flex items-center gap-1">
          <span class="material-symbols-outlined text-sm" style="font-variation-settings:'FILL'1">paid</span>
          ${reward}원
        </span>
      </div>
      <div class="lcf-pair">
        <span class="lcf-pair-label">성별 조건</span>
        <span class="lcf-pair-value flex items-center gap-1 min-w-0"><span class="material-symbols-outlined text-sm shrink-0">wc</span><span class="min-w-0">${col2g}</span></span>
      </div>
      <div class="lcf-pair">
        <span class="lcf-pair-label">소요시간</span>
        <span class="lcf-pair-value flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">schedule</span>
          ${timeStr}
        </span>
      </div>
      <div class="lcf-pair">
        <span class="lcf-pair-label">연령 조건</span>
        <span class="lcf-pair-value flex items-center gap-1 min-w-0"><span class="material-symbols-outlined text-sm shrink-0">cake</span><span class="min-w-0">${col2a}</span></span>
      </div>
      <div class="lcf-pair">
        <span class="lcf-pair-label">모집인원</span>
        <span class="lcf-pair-value flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">group</span>
          ${escapeHtml(mobStr)}
        </span>
      </div>
      <div class="lcf-pair">
        <span class="lcf-pair-label">기기 조건</span>
        <span class="lcf-pair-value flex items-center gap-1 min-w-0"><span class="material-symbols-outlined text-sm shrink-0">devices</span><span class="min-w-0">${col2d}</span></span>
      </div>
    </div>
  `;
}

/** 이메일 비교·저장 시 대소문자·공백 차이로 참여 이력이 갈라지지 않도록 통일 */
function normalizeEmail(email) {
  if (email == null || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

// ─── Listings ───
function getListings() {
  const list = getStore(KEYS.listings, SAMPLE_LISTINGS);
  return [...list].sort((a, b) => (b.id - a.id)).map(enrichListing); // 최신 등록(id 큰 것) 순
}

function getListingById(id) {
  if (id === undefined || id === null || id === '') return undefined;
  const n = Number(id);
  if (!Number.isFinite(n)) return undefined;
  return getListings().find(l => Number(l.id) === n);
}

function getDeadlineEndTime(deadline) {
  if (!deadline) return NaN;
  const d = new Date(deadline);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function getListingParticipantCount(listingId, listing) {
  const idStr = String(listingId);
  const participants = new Set(
    getCompleted()
      .filter(c => String(c.listingId) === idStr)
      .map(c => normalizeEmail(c.userEmail))
      .filter(Boolean)
  );
  const derived = participants.size;
  const stored =
    listing && typeof listing.currentParticipants === 'number' && Number.isFinite(listing.currentParticipants)
      ? Math.max(0, Math.floor(listing.currentParticipants))
      : 0;
  // 실제 완료 집계와 관리자가 조사 수정에서 저장한 값 중 큰 쪽 표시
  return Math.max(derived, stored);
}

// 마감 조건: 데드라인 지남 OR 참여인원 마감 (둘 중 하나만 해당해도 마감)
function isListingClosed(listing) {
  if (!listing) return true;
  const deadlinePassed = Date.now() > getDeadlineEndTime(listing.deadline);
  const maxParticipants = Number(listing.maxParticipants) || 0;
  const isFull = maxParticipants > 0 && getListingParticipantCount(listing.id, listing) >= maxParticipants;
  return deadlinePassed || isFull; // OR 조건
}

// ─── Settlement completed (정산완료) ───
// 저장 형식: [{ email, completedAt }, ...]. 레거시: [email, ...] → completedAt 과거로 간주
function getSettlementCompleted() {
  const raw = getStore(KEYS.settlementCompleted, []);
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw.map(entry =>
    typeof entry === 'string'
      ? { email: entry, completedAt: new Date(0).toISOString() }
      : { email: entry.email, completedAt: entry.completedAt || new Date(0).toISOString() }
  );
}

function getSettlementCompletedAt(email) {
  const list = getSettlementCompleted();
  const ne = normalizeEmail(email);
  const found = list.find(e => normalizeEmail(e.email) === ne);
  return found ? found.completedAt : null;
}

function isSettlementCompleted(email) {
  return getSettlementCompletedAt(email) !== null;
}

function markSettlementCompleted(email) {
  const list = getSettlementCompleted().filter(e => e.email !== email);
  setStore(KEYS.settlementCompleted, [...list, { email, completedAt: new Date().toISOString() }]);
}

// ─── Completed Surveys ───
function getCompleted() {
  return getStore(KEYS.completed, []);
}

/**
 * Supabase panel_completed → localStorage 병합 동기화.
 * 관리자 뷰 및 로그인 복원에 사용.
 */
async function syncCompletedFromSupabase() {
  try {
    const res = await fetch(
      `${SUPABASE_REST_BASE}/panel_completed?select=*&order=completed_at.desc`,
      { headers: getSupabaseHeaders() }
    );
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return;

    const mapped = rows.map(r => ({
      userEmail:   normalizeEmail(r.user_email),
      listingId:   Number(r.listing_id),
      completedAt: r.completed_at,
      reward:      r.reward || 0,
      title:       r.title  || '',
    }));

    // 로컬 기록(= 현재 세션에서 방금 추가한 항목 포함)과 병합 — 중복 제거
    const local = getStore(KEYS.completed, []);
    const merged = [...mapped];
    local.forEach(l => {
      const le = normalizeEmail(l.userEmail);
      const dup = merged.some(
        m => normalizeEmail(m.userEmail) === le && String(m.listingId) === String(l.listingId)
      );
      if (!dup) merged.push({ ...l, userEmail: le || l.userEmail });
    });
    setStore(KEYS.completed, merged);
  } catch (e) {
    console.warn('[supabase] syncCompleted failed:', e);
  }
}

function getUserCompleted() {
  if (!state.currentUser) return [];
  const me = normalizeEmail(state.currentUser.email);
  return getCompleted().filter(c => normalizeEmail(c.userEmail) === me);
}

async function markCompleted(listingId) {
  if (!state.currentUser) return false;
  const listing = getListingById(listingId);
  if (!listing) {
    console.warn('[markCompleted] listing not found for id:', listingId);
    return false;
  }
  if (isListingClosed(listing)) return false;

  const email = normalizeEmail(state.currentUser.email);
  if (!email) return false;

  const completed = getCompleted();
  const exists = completed.find(
    c => normalizeEmail(c.userEmail) === email && String(c.listingId) === String(listingId)
  );
  if (exists) return true;

  const lid = Number(listingId);
  const reward = getListingReward(listing);
  const entry = {
    userEmail: email,
    listingId: Number.isFinite(lid) ? lid : listingId,
    completedAt: new Date().toISOString(),
    reward,
    title: listing.title,
  };
  completed.push(entry);
  setStore(KEYS.completed, completed);

  // Supabase에도 기록 (다른 기기/관리자 조회용)
  try {
    const res = await fetch(`${SUPABASE_REST_BASE}/panel_completed`, {
      method: 'POST',
      headers: { ...getSupabaseHeaders(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_email:   entry.userEmail,
        listing_id:   entry.listingId,
        completed_at: entry.completedAt,
        reward:       entry.reward,
        title:        entry.title,
      }),
    });
    if (!res.ok) {
      console.warn('[supabase] markCompleted POST status', res.status, await res.text().catch(() => ''));
    }
  } catch (e) {
    console.warn('[supabase] markCompleted upsert failed:', e);
  }
  return true;
}

function isCompleted(listingId) {
  if (!state.currentUser) return false;
  const me = normalizeEmail(state.currentUser.email);
  return getCompleted().some(
    c => normalizeEmail(c.userEmail) === me && String(c.listingId) === String(listingId)
  );
}

// ─── Payouts ───
function getPayouts() { return getStore(KEYS.payouts, []); }

function getUserPayouts() {
  if (!state.currentUser) return [];
  const me = normalizeEmail(state.currentUser.email);
  return getPayouts().filter(p => normalizeEmail(p.userEmail) === me);
}

function getUnpaidTotal() {
  if (state.currentUser && isSettlementCompleted(state.currentUser.email)) {
    return 0;
  }
  const completed = getUserCompleted();
  const payouts = getUserPayouts();
  const paidTotal = payouts.reduce((sum, p) => sum + p.amount, 0);
  const earnedTotal = completed.reduce((sum, c) => sum + c.reward, 0);
  return earnedTotal - paidTotal;
}

function addPayout(name, phone, bankName, bankAccount) {
  const amount = getUnpaidTotal();
  if (amount <= 0) return { ok: false, error: '정산할 금액이 없습니다.' };

  const payouts = getPayouts();
  const payout = {
    userEmail: normalizeEmail(state.currentUser.email) || state.currentUser.email,
    userName: name,
    phone,
    bankName,
    bankAccount,
    amount,
    requestedAt: new Date().toISOString(),
  };
  payouts.push(payout);
  setStore(KEYS.payouts, payouts);
  return { ok: true, payout };
}

// ─── Email ───
async function sendPayoutEmail(payout) {
  const configured = EMAIL_CONFIG.serviceId && EMAIL_CONFIG.templateId && EMAIL_CONFIG.publicKey;

  if (configured) {
    try {
      emailjs.init(EMAIL_CONFIG.publicKey);
      await emailjs.send(EMAIL_CONFIG.serviceId, EMAIL_CONFIG.templateId, {
        to_email: EMAIL_CONFIG.recipientEmail,
        from_name: payout.userName,
        from_email: payout.userEmail,
        phone: payout.phone,
        bank_name: payout.bankName,
        bank_account: payout.bankAccount,
        amount: payout.amount.toLocaleString(),
        message: `정산 요청이 접수되었습니다.\n\n이름: ${payout.userName}\n이메일: ${payout.userEmail}\n전화번호: ${payout.phone}\n은행: ${payout.bankName}\n계좌번호: ${payout.bankAccount}\n금액: ${payout.amount.toLocaleString()}원\n요청일시: ${new Date(payout.requestedAt).toLocaleString('ko-KR')}`,
      });
      return { ok: true, method: 'emailjs' };
    } catch (err) {
      console.error('EmailJS error:', err);
      return { ok: false, method: 'emailjs', error: err };
    }
  }

  const subject = encodeURIComponent(`[AI 인터뷰 조사 정산 요청] ${payout.userName} — ${payout.amount.toLocaleString()}원`);
  const body = encodeURIComponent(
    `정산 요청이 접수되었습니다.\n\n` +
    `이름: ${payout.userName}\n` +
    `이메일: ${payout.userEmail}\n` +
    `전화번호: ${payout.phone}\n` +
    `은행: ${payout.bankName}\n` +
    `계좌번호: ${payout.bankAccount}\n` +
    `금액: ${payout.amount.toLocaleString()}원\n` +
    `요청일시: ${new Date(payout.requestedAt).toLocaleString('ko-KR')}`
  );
  window.open(`mailto:${EMAIL_CONFIG.recipientEmail}?subject=${subject}&body=${body}`, '_blank');
  return { ok: true, method: 'mailto' };
}

// ─── View Management ───
function updateHeaderAuth() {
  const loggedIn = !!state.currentUser;
  document.getElementById('btn-header-login').classList.toggle('hidden', loggedIn);
  document.getElementById('btn-profile').classList.toggle('hidden', !loggedIn);
  document.getElementById('header-divider').classList.toggle('hidden', !loggedIn);
  document.getElementById('btn-logout').classList.toggle('hidden', !loggedIn);
  if (loggedIn) {
    document.getElementById('header-user-name').textContent = state.currentUser.name || '';
  }
  const tabSettlement = document.querySelector('[data-tab="settlement"]');
  if (tabSettlement) tabSettlement.classList.toggle('hidden', !loggedIn);
  const btnEditProfileInline = document.getElementById('btn-edit-profile-inline');
  if (btnEditProfileInline) btnEditProfileInline.classList.toggle('hidden', !loggedIn);
}

function showAuthForm(mode = 'login') {
  state.authMode = mode === 'register' ? 'register' : 'login';
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  if (!loginForm || !registerForm) return;
  loginForm.classList.toggle('hidden', state.authMode !== 'login');
  registerForm.classList.toggle('hidden', state.authMode !== 'register');
}

function getRouteState() {
  const params = new URLSearchParams(window.location.search);
  // 기본값은 'app'(공고 목록). 명시적으로 ?view=login 일 때만 로그인 화면.
  const view = params.get('view') === 'login' ? 'login' : 'app';
  const mode = params.get('mode') === 'register' ? 'register' : 'login';
  return { view, mode };
}

function syncRoute(view, mode, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set('view', view);
  if (view === 'login') {
    url.searchParams.set('mode', mode === 'register' ? 'register' : 'login');
  } else {
    url.searchParams.delete('mode');
  }
  const nextState = { view, mode: mode === 'register' ? 'register' : 'login' };
  if (replace) {
    window.history.replaceState(nextState, '', url);
  } else {
    window.history.pushState(nextState, '', url);
  }
}

function showView(name, options = {}) {
  const { mode = state.authMode, syncHistory = true, replace = false } = options;
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');

  if (name === 'login') {
    document.documentElement.removeAttribute('data-boot-app');
    loginView.classList.remove('hidden');
    appView.classList.add('hidden');
    showAuthForm(mode);
  } else {
    loginView.classList.add('hidden');
    appView.classList.remove('hidden');
    updateHeaderAuth();
    switchTab(state.currentTab);
  }

  if (syncHistory) {
    syncRoute(name === 'app' ? 'app' : 'login', mode, replace);
  }
}

function switchTab(tab) {
  if (tab === 'users') tab = 'settlement'; // 구 탭명 호환: 유저 조회 → 마이 페이지에 통합됨
  state.currentTab = tab;

  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  document.querySelectorAll('.content-panel').forEach(p => p.classList.add('hidden'));

  if (tab === 'listings') {
    document.getElementById('listings-view').classList.remove('hidden');
    renderListings();
  } else if (tab === 'settlement') {
    document.getElementById('settlement-view').classList.remove('hidden');
    renderSettlement();
    renderUsers();
  }
}


// ─── Render: Listings ───
function buildListingCard(listing) {
  const completed = isCompleted(listing.id);
  const isActive = !isListingClosed(listing);
  const actionBtn = completed
    ? `<button class="card-btn-done" disabled>
         <span class="material-symbols-outlined text-base" style="font-variation-settings:'FILL'1">check_circle</span>
         정산 대기 중
       </button>`
    : isActive
      ? `<a href="${listing.surveyLink}" target="_blank" rel="noopener noreferrer"
            class="card-btn-survey"
            data-id="${listing.id}"
            data-title="${listing.title.replace(/"/g, '&quot;')}"
            data-category="${(listing.category || '').replace(/"/g, '&quot;')}">
           <span class="material-symbols-outlined text-base">open_in_new</span>
           인터뷰 참여
         </a>`
      : `<span class="card-btn-closed">마감됨</span>`;
  const editBtn = isAdmin()
    ? `<button class="btn-edit-listing" data-id="${listing.id}" title="수정">
         <span class="material-symbols-outlined text-base">edit</span>
       </button>`
    : '';
  return `
    <div class="listing-card${completed ? ' listing-card--done' : ''}">
      <div class="listing-card-header">
        <div class="flex flex-wrap gap-1.5">
          <span class="badge badge-category">${listing.category}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge ${!isActive ? 'badge-closed' : (completed || listing.deadline) ? 'badge-done' : 'badge-active'}">
            ${!isActive ? '마감' : completed ? (listing.deadline ? `${formatDate(listing.deadline)} 마감` : '정산 대기 중') : (listing.deadline ? `${formatDate(listing.deadline)} 마감` : '모집중')}
          </span>
          ${editBtn}
        </div>
      </div>
      <div class="listing-card-body">
        <h3 class="text-sm font-bold leading-snug mb-1.5">${listing.title}</h3>
        <p class="text-xs text-white/45 leading-relaxed line-clamp-2">${listing.description}</p>
      </div>
      <div class="listing-card-footer">
        ${buildListingFooterTwoColGridHtml(listing)}
        <div class="listing-card-footer-cta">${actionBtn}</div>
      </div>
    </div>
  `;
}

function renderListings() {
  const sectionsEl = document.getElementById('listings-sections');
  const emptyEl = document.getElementById('listings-empty');
  const gridActive = document.getElementById('listings-grid-active');
  const gridClosed = document.getElementById('listings-grid-closed');
  const emptyActive = document.getElementById('listings-active-empty');
  const emptyClosed = document.getElementById('listings-closed-empty');
  const query = state.searchQuery.toLowerCase().trim();
  const btnAdd = document.getElementById('btn-add-listing');
  if (btnAdd) btnAdd.classList.toggle('hidden', !isAdmin());

  let listings = getListings();
  if (query) {
    listings = listings.filter(l =>
      l.title.toLowerCase().includes(query) ||
      l.category.toLowerCase().includes(query) ||
      l.description.toLowerCase().includes(query)
    );
  }

  const activeListings = listings.filter(l => !isListingClosed(l));
  const closedListings = listings.filter(l => isListingClosed(l));

  if (listings.length === 0) {
    if (sectionsEl) sectionsEl.classList.add('hidden');
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (emptyEl) emptyEl.classList.add('hidden');
  if (sectionsEl) sectionsEl.classList.remove('hidden');

  if (gridActive) {
    gridActive.innerHTML = activeListings.map(buildListingCard).join('');
    gridActive.classList.toggle('hidden', activeListings.length === 0);
  }
  if (emptyActive) {
    emptyActive.classList.toggle('hidden', activeListings.length > 0);
  }
  if (gridClosed) {
    gridClosed.innerHTML = closedListings.map(buildListingCard).join('');
    gridClosed.classList.toggle('hidden', closedListings.length === 0);
  }
  if (emptyClosed) {
    emptyClosed.classList.toggle('hidden', closedListings.length > 0);
  }

  const container = sectionsEl || document.body;
  container.querySelectorAll('.card-btn-survey').forEach(btn => {
    btn.addEventListener('click', async e => {
      if (!state.currentUser) {
        e.preventDefault();
        showView('login');
        return;
      }
      const id = Number(btn.dataset.id);
      // 트래킹은 listing 조회 성공 여부와 무관하게 항상 실행 (data-* 속성 fallback)
      const listing = getListingById(id);
      trackSurveyClick({
        title:    listing?.title    || btn.dataset.title    || String(id),
        listing_id: id,
        category: listing?.category || btn.dataset.category || '',
        source:   'card',
      });
      const ok = await markCompleted(id);
      renderListings();
      if (ok) showToast('정산 대기 중으로 기록되었습니다.');
      else showToast('조사를 찾지 못해 기록하지 못했습니다. 새로고침 후 다시 시도해 주세요.');
    });
  });
}

// ─── Render: Detail ───
function renderDetail(listingId) {
  const listing = getListingById(listingId);
  if (!listing) return;

  const completed = isCompleted(listingId);
  const isActive = !isListingClosed(listing);
  const container = document.getElementById('detail-content');

  container.innerHTML = `
    <div class="detail-hero">
      <div class="flex flex-wrap gap-2 mb-4">
        <span class="badge badge-category">${listing.category}</span>
        <span class="badge ${!isActive ? 'badge-closed' : (completed || listing.deadline) ? 'badge-done' : 'badge-active'}">
          ${!isActive ? '마감' : completed ? (listing.deadline ? formatDate(listing.deadline) + ' 마감' : '정산 대기 중') : (listing.deadline ? formatDate(listing.deadline) + ' 마감' : '모집중')}
        </span>
      </div>
      <h1 class="text-2xl md:text-3xl font-black tracking-tight leading-tight mb-3">
        ${listing.title}
      </h1>
      <p class="text-sm text-white/50 leading-relaxed max-w-2xl">
        ${listing.description}
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="detail-section">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
          <span class="material-symbols-outlined" style="color:var(--accent-text);font-size:1.125rem">payments</span>
          <span class="info-label">사례비</span>
        </div>
        <p style="font-size:1.25rem;font-weight:900">${getListingReward(listing).toLocaleString()}<span class="summary-card__unit">원</span></p>
      </div>
      <div class="detail-section">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
          <span class="material-symbols-outlined" style="color:var(--accent-text);font-size:1.125rem">schedule</span>
          <span class="info-label">예상 소요시간</span>
        </div>
        <p style="font-size:1.25rem;font-weight:900">${listing.estimatedTime}</p>
      </div>
      <div class="detail-section">
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
          <span class="material-symbols-outlined" style="color:var(--accent-text);font-size:1.125rem">event</span>
          <span class="info-label">마감일</span>
        </div>
        <p style="font-size:1.25rem;font-weight:900">${formatDate(listing.deadline)}</p>
      </div>
    </div>

    <div class="detail-conditions mb-6">
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem">
        <span class="material-symbols-outlined" style="color:var(--accent-text);font-size:1.125rem">groups</span>
        <span class="info-label">참여 조건</span>
      </div>
      <div style="font-size:0.875rem;line-height:1.6">
        ${buildListingConditionsHtml(listing)}
      </div>
    </div>

    <div class="detail-action">
      ${isActive && !completed ? `
        <a href="${listing.surveyLink}" target="_blank" rel="noopener noreferrer" class="btn-survey">
          <span class="material-symbols-outlined">open_in_new</span>
          인터뷰 참여하기
        </a>
        <button class="btn-complete" data-listing-id="${listing.id}">
          <span class="material-symbols-outlined">check_circle</span>
          참여 완료 표시
        </button>
      ` : completed ? `
        <div class="flex items-center gap-2 text-accent-lt text-sm font-semibold">
          <span class="material-symbols-outlined">schedule</span>
          정산 대기 중
        </div>
      ` : `
        <div class="flex items-center gap-2 text-white/40 text-sm font-semibold">
          <span class="material-symbols-outlined">block</span>
          마감된 인터뷰입니다
        </div>
      `}
    </div>
  `;

  const completeBtn = container.querySelector('.btn-complete');
  if (completeBtn) {
    completeBtn.addEventListener('click', async () => {
      trackSurveyClick({ title: listing.title, listing_id: listing.id, category: listing.category, source: 'detail-complete' });
      const ok = await markCompleted(listingId);
      renderDetail(listingId);
      if (ok) showToast('정산 대기 중으로 기록되었습니다.');
      else showToast('조사를 찾지 못해 기록하지 못했습니다. 새로고침 후 다시 시도해 주세요.');
    });
  }
  const surveyLinkEl = container.querySelector('.btn-survey');
  if (surveyLinkEl) {
    surveyLinkEl.addEventListener('click', () => {
      trackSurveyClick({ title: listing.title, listing_id: listing.id, category: listing.category, source: 'detail' });
    });
  }
}

// ─── Render: Settlement ───
function renderSettlement() {
  const list = document.getElementById('settlement-list');
  const empty = document.getElementById('settlement-empty');
  const totalEl = document.getElementById('total-amount');

  const completed = getUserCompleted();
  const unpaidTotal = getUnpaidTotal();

  if (totalEl) totalEl.textContent = unpaidTotal.toLocaleString();

  // 계좌정보 카드 렌더링
  const bankCard = document.getElementById('bank-info-card');
  if (bankCard) {
    const u = getMergedCurrentUser() || state.currentUser;
    const hasBankInfo = u.bankName && u.bankAccount;
    bankCard.innerHTML = `
      ${!hasBankInfo ? `
      <div class="bank-alert">
        <span class="material-symbols-outlined bank-alert__icon text-2xl" style="font-variation-settings:'FILL'1">error</span>
        <div class="min-w-0">
          <p class="bank-alert__title">계좌번호를 꼭 입력해 주세요</p>
          <p class="bank-alert__body">
            정산은 <strong style="color:#fff">은행명·계좌번호가 등록된 경우에만</strong> 가능합니다. 아래에 입력한 뒤 <strong style="color:#fff">저장</strong>까지 완료해 주세요.
          </p>
        </div>
      </div>
      ` : ''}
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem">
        <div class="icon-wrap icon-wrap--accent">
          <span class="material-symbols-outlined" style="font-size:1.125rem">account_balance</span>
        </div>
        <div>
          <p class="info-label" style="margin-bottom:0.125rem">계좌 정보</p>
          ${hasBankInfo
            ? `<p style="font-size:0.875rem;font-weight:700">${escapeHtml(u.bankName)} <span style="color:rgba(255,255,255,0.5);font-weight:400">${escapeHtml(u.bankAccount)}</span></p>`
            : `<p style="font-size:0.875rem;font-weight:600;color:rgba(254,240,138,0.9)">미등록 — 정산 불가</p>`
          }
        </div>
        <button id="btn-toggle-bank-form" class="btn-bank-toggle ${hasBankInfo ? 'btn-bank-toggle--edit' : 'btn-bank-toggle--add'}">
          ${hasBankInfo ? '수정' : '계좌 입력하기'}
        </button>
      </div>
      <div id="bank-form" class="${hasBankInfo ? 'hidden' : ''} space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="info-label" style="display:block;margin-bottom:0.375rem">은행명</label>
            <input type="text" id="bank-name-input" class="sf-input w-full" placeholder="하나은행" value="${escapeHtml(u.bankName || '')}">
          </div>
          <div>
            <label class="info-label" style="display:block;margin-bottom:0.375rem">계좌번호</label>
            <input type="text" id="bank-account-input" class="sf-input w-full" placeholder="000-0000-0000" value="${escapeHtml(u.bankAccount || '')}">
          </div>
        </div>
        <div class="flex gap-2 pt-1">
          <button id="btn-save-bank" class="btn-primary px-5 py-2 text-xs font-bold">저장</button>
          <button id="btn-cancel-bank" class="btn-ghost px-5 py-2 text-xs font-bold">취소</button>
        </div>
      </div>
    `;

    document.getElementById('btn-toggle-bank-form').addEventListener('click', () => {
      document.getElementById('bank-form').classList.toggle('hidden');
    });
    document.getElementById('btn-cancel-bank').addEventListener('click', () => {
      document.getElementById('bank-form').classList.add('hidden');
    });
    const bnInput = document.getElementById('bank-name-input');
    const baInput = document.getElementById('bank-account-input');
    const tryCommitBankInfo = async (showSavedToast) => {
      const bn = bnInput.value.trim();
      const ba = baInput.value.trim();
      if (!bn || !ba) return;
      const unchanged =
        state.currentUser?.bankName === bn && state.currentUser?.bankAccount === ba;
      if (unchanged) return;
      await saveBankInfo(bn, ba);
      if (showSavedToast) showToast('계좌정보가 저장되었습니다!');
      renderSettlement();
    };
    const scheduleBankAutosave = () => {
      clearTimeout(bankInfoAutosaveTimer);
      bankInfoAutosaveTimer = setTimeout(() => {
        tryCommitBankInfo(true);
      }, 550);
    };
    bnInput.addEventListener('input', scheduleBankAutosave);
    baInput.addEventListener('input', scheduleBankAutosave);
    document.getElementById('btn-save-bank').addEventListener('click', async () => {
      const bn = bnInput.value.trim();
      const ba = baInput.value.trim();
      if (!bn || !ba) { showToast('은행명과 계좌번호를 모두 입력하세요.'); return; }
      clearTimeout(bankInfoAutosaveTimer);
      const unchanged =
        state.currentUser?.bankName === bn && state.currentUser?.bankAccount === ba;
      if (!unchanged) await saveBankInfo(bn, ba);
      showToast('계좌정보가 저장되었습니다!');
      renderSettlement();
    });
  }

  if (completed.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  const payoutHistory = getUserPayouts();
  const settledAt = state.currentUser ? getSettlementCompletedAt(state.currentUser.email) : null;

  list.innerHTML =
    completed.map(c => {
      const completedTime = c.completedAt ? new Date(c.completedAt).getTime() : 0;
      const settledTime = settledAt ? new Date(settledAt).getTime() : 0;
      const isLegacySettled = settledTime < 1e12;
      const showBadge = settledAt && (isLegacySettled || completedTime < settledTime);
      return `
      <div class="settlement-item">
        <div class="flex items-center gap-3">
          <div class="icon-wrap icon-wrap--accent">
            <span class="material-symbols-outlined" style="font-size:1.125rem">description</span>
          </div>
          <div>
            <p style="font-size:0.875rem;font-weight:600;line-height:1.3;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap">
              ${c.title}
              ${showBadge ? '<span class="badge-settlement-done">정산 완료</span>' : '<span class="badge-review">정산 대기 중</span>'}
            </p>
            <p style="font-size:0.75rem;color:rgba(255,255,255,0.35);margin-top:0.125rem">${formatDate(c.completedAt)}</p>
          </div>
        </div>
        <span class="settlement-amount--earn">+${c.reward.toLocaleString()}원</span>
      </div>
    `;
    }).join('') +
    (payoutHistory.length > 0 ? `
      <p class="subsection-title">정산 요청 내역</p>
      ${payoutHistory.map(p => `
        <div class="settlement-item settlement-item--paid">
          <div class="flex items-center gap-3">
            <div class="icon-wrap icon-wrap--green">
              <span class="material-symbols-outlined" style="font-size:1.125rem">receipt</span>
            </div>
            <div>
              <p style="font-size:0.875rem;font-weight:600;line-height:1.3">정산 요청</p>
              <p style="font-size:0.75rem;color:rgba(255,255,255,0.35);margin-top:0.125rem">${formatDate(p.requestedAt)} · ${p.bankName} ${p.bankAccount}</p>
            </div>
          </div>
          <span class="settlement-amount--paid">−${p.amount.toLocaleString()}원</span>
        </div>
      `).join('')}
    ` : '');
}

// ─── Render: Users (Admin) ───
async function renderUsers() {
  const adminSection = document.getElementById('admin-section');
  if (!isAdmin()) {
    if (adminSection) adminSection.classList.add('hidden');
    return;
  }
  if (adminSection) adminSection.classList.remove('hidden');

  const container = document.getElementById('users-list');
  const empty = document.getElementById('users-empty');
  if (!container) return;
  // 참여 이력과 유저 목록 모두 서버에서 최신화
  await Promise.all([syncUsersFromSupabase(), syncCompletedFromSupabase()]);

  const users = getUsers();
  const completed = getCompleted();
  const listings = getListings();

  const byEmail = {};
  completed.forEach(c => {
    const em = normalizeEmail(c.userEmail);
    if (!em) return;
    if (!byEmail[em]) byEmail[em] = { count: 0, total: 0 };
    byEmail[em].count += 1;
    byEmail[em].total += c.reward;
  });

  // 조사 참여자 현황에서 제외할 테스트 계정
  const EXCLUDED_EMAILS = new Set([
    '123@123.com',
    '1234@1234@.com',
    '12345@12345.com',
    '234@234.com',
    'lee880728@gmail.com',
  ]);

  const participantsByListingId = {};
  completed.forEach(c => {
    const em = normalizeEmail(c.userEmail);
    if (!em || EXCLUDED_EMAILS.has(em)) return;
    const id = Number(c.listingId);
    if (!id) return;
    if (!participantsByListingId[id]) participantsByListingId[id] = new Set();
    participantsByListingId[id].add(em);
  });

  // 진행중 조사는 항상 표시. 마감 조사는 참여 기록이 있는 경우에만 표시(마감 후에도 이력 확인 가능)
  const listingIdsWithParticipants = new Set(
    Object.keys(participantsByListingId).map(k => Number(k)).filter(n => Number.isFinite(n) && n > 0)
  );
  const listingsForParticipantView = (listings || [])
    .filter(l => {
      if (!l) return false;
      if (!isListingClosed(l)) return true;
      return listingIdsWithParticipants.has(Number(l.id));
    })
    .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

  const participantSectionHtml =
    listingsForParticipantView.length === 0
      ? `<div class="px-6 py-8 text-sm text-white/40">표시할 조사가 없습니다</div>`
      : listingsForParticipantView.map(listing => {
          const set = participantsByListingId[listing.id] || new Set();
          const emails = Array.from(set);
          const reward = listing.reward || getListingReward(listing) || 0;
          const totalPayout = emails.length * reward;
          const rows = emails.map(email => {
            const u = users.find(x => normalizeEmail(x.email) === email);
            const name = u?.name || '—';
            const phoneDisplay = u?.phone ? u.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3') : '—';
            return `
            <tr>
              <td>${escapeHtml(name)}</td>
              <td style="color:rgba(255,255,255,0.6)">${escapeHtml(email)}</td>
              <td style="color:rgba(255,255,255,0.6)">${escapeHtml(phoneDisplay)}</td>
              <td class="settlement-amount--earn">${reward.toLocaleString()}원</td>
            </tr>
          `;
          }).join('');

          const adminUrl = listing.adminUrl || '';
          const closed = isListingClosed(listing);
          return `
          <div class="participant-section" data-listing-id="${listing.id}">
            <div class="participant-section__title-row">
              <p class="participant-section__title">${escapeHtml(listing.title || '제목 없음')}</p>
              ${closed ? '<span class="badge badge-closed text-xs shrink-0">마감</span>' : ''}
              ${totalPayout > 0 ? `<span class="badge-payout-total">총 지급 ${totalPayout.toLocaleString()}원</span>` : ''}
            </div>
            <p class="participant-section__meta">
              참여자 ${emails.length.toLocaleString()}명
              ${listing.maxParticipants ? ` / 최종모수 ${Number(listing.maxParticipants).toLocaleString()}명` : ''}
              · 사례비 ${reward.toLocaleString()}원
            </p>
            <div class="participant-section__url-row">
              <span class="material-symbols-outlined info-label" style="font-size:14px">link</span>
              <input type="url"
                class="admin-url-input"
                placeholder="관련 URL 입력 (선택)"
                value="${escapeHtml(adminUrl)}"
                data-listing-id="${listing.id}">
              ${adminUrl ? `<a href="${escapeHtml(adminUrl)}" target="_blank" rel="noopener" class="participant-section__url-open"><span class="material-symbols-outlined" style="font-size:13px">open_in_new</span></a>` : ''}
            </div>
            <div class="participant-section__table-wrap">
              <table class="users-table users-table-nowrap">
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>이메일</th>
                    <th>전화번호</th>
                    <th>사례비</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || `<tr><td style="color:rgba(255,255,255,0.4)" colspan="4">참여자가 없습니다</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;
        }).join('');

  if (users.length === 0) {
    container.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
  } else {
    if (empty) empty.classList.add('hidden');
    container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="users-table users-table-nowrap">
        <thead>
          <tr>
            <th>총 사례비</th>
            <th>은행명</th>
            <th>계좌번호</th>
            <th>정산완료</th>
            <th>이름</th>
            <th>이메일</th>
            <th>전화번호</th>
            <th>가입일</th>
            <th>생년월일</th>
            <th>성별</th>
            <th>직업</th>
            <th>완료 인터뷰</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const stat = byEmail[normalizeEmail(u.email)] || { count: 0, total: 0 };
            const displayTotal = isSettlementCompleted(u.email) ? 0 : stat.total;
            const joined = u.createdAt ? formatDate(u.createdAt) : '—';
            const isMe = u.email === state.currentUser.email;
            const phoneDisplay = u.phone ? u.phone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3') : '—';
            const settled = isSettlementCompleted(u.email);
            return `
              <tr>
                <td class="text-yellow-300/80">${displayTotal.toLocaleString()}원</td>
                <td class="text-white/60">${escapeHtml(u.bankName || '—')}</td>
                <td class="text-white/60">${escapeHtml(u.bankAccount || '—')}</td>
                <td>
                  ${settled
                    ? '<span class="text-white/40 text-xs">완료</span>'
                    : `<button class="btn-settlement-done text-xs font-bold text-accent-lt hover:text-white transition-colors px-2 py-1 rounded hover:bg-accent/20" data-email="${escapeHtml(u.email)}">정산완료</button>`
                  }
                </td>
                <td>${escapeHtml(u.name)}</td>
                <td class="text-white/60">${escapeHtml(u.email)}</td>
                <td class="text-white/60">${escapeHtml(phoneDisplay)}</td>
                <td class="text-white/50">${joined}</td>
                <td class="text-white/60">${escapeHtml(u.birthdate || '—')}</td>
                <td class="text-white/60">${escapeHtml(u.gender || '—')}</td>
                <td class="text-white/60">${escapeHtml(u.job || '—')}</td>
                <td>${stat.count}건</td>
                <td>
                  ${isMe ? '' : `
                    <button class="btn-delete-user text-xs font-bold text-red-400/70 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-400/10"
                      data-email="${escapeHtml(u.email)}">삭제</button>
                  `}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
    container.querySelectorAll('.btn-settlement-done').forEach(btn => {
      btn.addEventListener('click', () => {
        const email = btn.dataset.email;
        if (!confirm(`"${email}" 유저의 정산을 완료 처리하시겠습니까? 합산 금액이 0으로 표시됩니다.`)) return;
        markSettlementCompleted(email);
        renderUsers();
        showToast('정산 완료 처리되었습니다.');
      });
    });
    container.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const email = btn.dataset.email;
        if (!confirm(`"${email}" 유저를 삭제하시겠습니까?`)) return;
        await deleteUser(email);
        await renderUsers();
        showToast('유저가 삭제되었습니다.');
      });
    });
  }

  // ─── 사례비 집계 요약 ───
  const summaryEl = document.getElementById('payout-summary');
  if (summaryEl) {
    let paidTotal = 0;
    let pendingTotal = 0;
    users.forEach(u => {
      const stat = byEmail[normalizeEmail(u.email)];
      if (!stat) return;
      if (isSettlementCompleted(u.email)) {
        paidTotal += stat.total;
      } else {
        pendingTotal += stat.total;
      }
    });
    summaryEl.innerHTML = `
      <div style="margin-bottom:1rem">
        <h2 style="font-size:1.25rem;font-weight:900;letter-spacing:-0.02em">사례비 집계</h2>
        <p style="font-size:0.875rem;color:rgba(255,255,255,0.4);margin-top:0.25rem">전체 유저의 정산 현황을 집계합니다</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div class="glass summary-card">
          <div class="icon-wrap icon-wrap--green">
            <span class="material-symbols-outlined" style="font-size:1.125rem;line-height:1">check_circle</span>
          </div>
          <div>
            <p class="summary-card__label">지급 완료</p>
            <p class="summary-card__value summary-card__value--green">${paidTotal.toLocaleString()}<span class="summary-card__unit">원</span></p>
          </div>
        </div>
        <div class="glass summary-card">
          <div class="icon-wrap icon-wrap--yellow">
            <span class="material-symbols-outlined" style="font-size:1.125rem;line-height:1">schedule</span>
          </div>
          <div>
            <p class="summary-card__label">지급 예정</p>
            <p class="summary-card__value summary-card__value--yellow">${pendingTotal.toLocaleString()}<span class="summary-card__unit">원</span></p>
          </div>
        </div>
      </div>
    `;
  }

  const participantsEl = document.getElementById('users-participants');
  if (participantsEl) {
    participantsEl.innerHTML = participantSectionHtml;

    let adminUrlTimer = null;
    participantsEl.querySelectorAll('.admin-url-input').forEach(input => {
      const save = () => {
        const id = Number(input.dataset.listingId);
        if (!id) return;
        const url = input.value.trim();
        const all = getStore(KEYS.listings, []);
        const updated = all.map(l => Number(l.id) === id ? { ...l, adminUrl: url } : l);
        setStore(KEYS.listings, updated);
        // 외부링크 아이콘 토글
        const wrap = input.parentElement;
        const existing = wrap.querySelector('a.admin-url-open');
        if (url) {
          if (!existing) {
            const a = document.createElement('a');
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener';
            a.className = 'admin-url-open participant-section__url-open';
            a.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px">open_in_new</span>';
            wrap.appendChild(a);
          } else {
            existing.href = url;
          }
        } else if (existing) {
          existing.remove();
        }
      };
      input.addEventListener('input', () => {
        clearTimeout(adminUrlTimer);
        adminUrlTimer = setTimeout(save, 600);
      });
      input.addEventListener('change', save);
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ─── Utilities ───
// estimatedTime(예: "5분", "3~5분", "15~20분")으로 구간별 사례비 계산
// 5분 이하=1,000원 / 5초과~15이하=3,000원 / 15초과~30이하=5,000원 / 30초과=10,000원
function getRewardByEstimatedTime(estimatedTime) {
  const str = String(estimatedTime || '');
  const nums = str.match(/\d+/g);
  const minutes = nums && nums.length ? Math.max(...nums.map(Number)) : 0;
  if (minutes <= 5) return 1000;
  if (minutes <= 15) return 3000;
  if (minutes <= 30) return 5000;
  return 10000;
}

function getListingReward(listing) {
  return getRewardByEstimatedTime(listing.estimatedTime);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  msgEl.textContent = message;
  toast.classList.remove('hidden');
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 3000);
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.classList.remove('hidden');
}

function hideError(elementId) {
  const el = document.getElementById(elementId);
  el.textContent = '';
  el.classList.add('hidden');
}

async function openTermsModal(type) {
  const modal = document.getElementById('terms-modal');
  const titleEl = document.getElementById('terms-modal-title');
  const contentEl = document.getElementById('terms-modal-content');
  if (!modal || !titleEl || !contentEl) return;

  const map = {
    service: {
      title: '서비스 이용약관',
      path: './terms/service-terms.md',
    },
    privacy: {
      title: '개인정보 수집 및 이용 동의',
      path: './terms/privacy-collection-consent.md',
    },
  };
  const target = map[type];
  if (!target) return;

  titleEl.textContent = target.title;
  contentEl.textContent = '불러오는 중...';
  modal.classList.remove('hidden');

  try {
    const res = await fetch(target.path);
    if (!res.ok) throw new Error('약관 파일을 불러올 수 없습니다.');
    const text = await res.text();
    contentEl.textContent = text;
  } catch (e) {
    contentEl.textContent = '약관 원문을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
  }
}

function closeTermsModal() {
  document.getElementById('terms-modal')?.classList.add('hidden');
}

// ─── Admin: Add / Edit listing ───
function syncListingAdminParticipantFieldVisibility() {
  const wrap = document.getElementById('listing-admin-current-participants-wrap');
  if (wrap) wrap.classList.toggle('hidden', !isAdmin());
}

/** 관리자(chris@proby.io)만 모달에서 조정. 최종 모수 이하·0 이상(정수). */
function readAdminCurrentParticipantsFromModal(maxParticipants) {
  if (!isAdmin()) return { ok: true, currentParticipants: 0 };
  const raw = String(document.getElementById('listing-currentParticipants')?.value ?? '').trim();
  const n = raw === '' ? 0 : Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: '현재 참여 인원은 0 이상의 숫자로 입력하세요.' };
  }
  const cp = Math.floor(n);
  if (cp > maxParticipants) {
    return { ok: false, error: '현재 참여 인원은 최종 모수(명)를 초과할 수 없습니다.' };
  }
  return { ok: true, currentParticipants: cp };
}

function openAddListingModal() {
  if (!isAdmin()) return;
  hideError('add-listing-error');
  const modal = document.getElementById('add-listing-modal');
  if (!modal) return;

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  document.getElementById('listing-edit-id').value = '';
  document.getElementById('listing-title').value = '';
  document.getElementById('listing-category').value = '';
  document.getElementById('listing-estimatedTime').value = '';
  document.getElementById('listing-description').value = '';
  document.getElementById('listing-surveyLink').value = '';
  document.getElementById('listing-deadline').value = `${yyyy}-${mm}-${dd}`;
  document.getElementById('listing-maxParticipants').value = '';
  const cpEl = document.getElementById('listing-currentParticipants');
  if (cpEl) cpEl.value = '0';
  clearParticipantFieldsInModal();
  syncListingAdminParticipantFieldVisibility();

  modal.querySelector('h2').textContent = '조사 추가';
  document.getElementById('btn-submit-add-listing').textContent = '생성하기';
  modal.classList.remove('hidden');
}

function openEditListingModal(id) {
  if (!isAdmin()) return;
  const listing = getListingById(Number(id));
  if (!listing) return;
  hideError('add-listing-error');
  const modal = document.getElementById('add-listing-modal');
  if (!modal) return;

  document.getElementById('listing-edit-id').value = listing.id;
  document.getElementById('listing-title').value = listing.title || '';
  document.getElementById('listing-category').value = listing.category || '';
  document.getElementById('listing-estimatedTime').value = listing.estimatedTime || '';
  document.getElementById('listing-description').value = listing.description || '';
  document.getElementById('listing-surveyLink').value = listing.surveyLink || '';
  document.getElementById('listing-deadline').value = listing.deadline || '';
  document.getElementById('listing-maxParticipants').value = listing.maxParticipants || '';
  const cpEl = document.getElementById('listing-currentParticipants');
  if (cpEl) {
    // 카드에 보이는 숫자(max(집계, 관리자저장))와 동일하게 표시
    const shown = getListingParticipantCount(listing.id, listing);
    cpEl.value = String(Math.max(0, Math.floor(shown)));
  }
  applyParticipantFieldsToModal(listing);
  syncListingAdminParticipantFieldVisibility();

  modal.querySelector('h2').textContent = '조사 수정';
  document.getElementById('btn-submit-add-listing').textContent = '저장하기';
  modal.classList.remove('hidden');
}

function closeAddListingModal() {
  const modal = document.getElementById('add-listing-modal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function readParticipantFieldsFromModal() {
  const participantGenders = [];
  if (document.getElementById('listing-gender-male')?.checked) participantGenders.push('male');
  if (document.getElementById('listing-gender-female')?.checked) participantGenders.push('female');
  const participantAgeRanges = [];
  PART_AGE_ORDER.forEach(n => {
    if (document.getElementById(`listing-age-${n}`)?.checked) participantAgeRanges.push(n);
  });
  const participantDevices = [];
  if (document.getElementById('listing-device-pc')?.checked) participantDevices.push('pc');
  if (document.getElementById('listing-device-mobile')?.checked) participantDevices.push('mobile');
  return { participantGenders, participantAgeRanges, participantDevices };
}

function clearParticipantFieldsInModal() {
  ['listing-gender-male', 'listing-gender-female', 'listing-device-pc', 'listing-device-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
  PART_AGE_ORDER.forEach(n => {
    const el = document.getElementById(`listing-age-${n}`);
    if (el) el.checked = false;
  });
}

function applyParticipantFieldsToModal(listing) {
  const l = enrichListing(listing);
  const gm = document.getElementById('listing-gender-male');
  const gf = document.getElementById('listing-gender-female');
  if (gm) gm.checked = l.participantGenders.includes('male');
  if (gf) gf.checked = l.participantGenders.includes('female');
  PART_AGE_ORDER.forEach(n => {
    const el = document.getElementById(`listing-age-${n}`);
    if (el) el.checked = l.participantAgeRanges.includes(n);
  });
  const dPc = document.getElementById('listing-device-pc');
  const dMob = document.getElementById('listing-device-mobile');
  if (dPc) dPc.checked = l.participantDevices.includes('pc');
  if (dMob) dMob.checked = l.participantDevices.includes('mobile');
}

function createListingFromModal() {
  if (!isAdmin()) return { ok: false, error: '권한이 없습니다.' };

  const title = document.getElementById('listing-title')?.value.trim();
  const category = document.getElementById('listing-category')?.value.trim();
  const estimatedTime = document.getElementById('listing-estimatedTime')?.value.trim();
  const description = document.getElementById('listing-description')?.value.trim();
  const surveyLink = document.getElementById('listing-surveyLink')?.value.trim();
  const deadline = document.getElementById('listing-deadline')?.value;
  const maxParticipantsRaw = document.getElementById('listing-maxParticipants')?.value;
  const maxParticipants = Number(maxParticipantsRaw);

  if (!title) return { ok: false, error: '조사명을 입력하세요.' };
  if (!category) return { ok: false, error: '카테고리를 입력하세요.' };
  if (!estimatedTime) return { ok: false, error: '예상 소요시간을 입력하세요.' };
  if (!description) return { ok: false, error: '설명을 입력하세요.' };
  if (!surveyLink) return { ok: false, error: '설문 링크를 입력하세요.' };
  if (!deadline) return { ok: false, error: '마감일을 입력하세요.' };
  if (!Number.isFinite(maxParticipants) || maxParticipants <= 0) return { ok: false, error: '최종 모수(명)를 올바르게 입력하세요.' };

  const cpRes = readAdminCurrentParticipantsFromModal(maxParticipants);
  if (!cpRes.ok) return { ok: false, error: cpRes.error };

  const { participantGenders, participantAgeRanges, participantDevices } = readParticipantFieldsFromModal();

  const current = getStore(KEYS.listings, SAMPLE_LISTINGS) || [];
  const maxId = current.reduce((m, l) => Math.max(m, Number(l?.id) || 0), 0);
  const id = maxId + 1;

  const listing = {
    id,
    title,
    description,
    surveyLink,
    deadline,
    status: 'active',
    category,
    estimatedTime,
    maxParticipants,
    currentParticipants: cpRes.currentParticipants,
    participantGenders,
    participantAgeRanges,
    participantDevices,
  };

  setStore(KEYS.listings, [listing, ...current]);
  trackListingCreated(listing);
  return { ok: true, listing };
}

function updateListingFromModal() {
  if (!isAdmin()) return { ok: false, error: '권한이 없습니다.' };

  const id = Number(document.getElementById('listing-edit-id')?.value);
  if (!id) return { ok: false, error: '수정할 조사를 찾을 수 없습니다.' };

  const title = document.getElementById('listing-title')?.value.trim();
  const category = document.getElementById('listing-category')?.value.trim();
  const estimatedTime = document.getElementById('listing-estimatedTime')?.value.trim();
  const description = document.getElementById('listing-description')?.value.trim();
  const surveyLink = document.getElementById('listing-surveyLink')?.value.trim();
  const deadline = document.getElementById('listing-deadline')?.value;
  const maxParticipants = Number(document.getElementById('listing-maxParticipants')?.value);

  if (!title) return { ok: false, error: '조사명을 입력하세요.' };
  if (!category) return { ok: false, error: '카테고리를 입력하세요.' };
  if (!estimatedTime) return { ok: false, error: '예상 소요시간을 입력하세요.' };
  if (!description) return { ok: false, error: '설명을 입력하세요.' };
  if (!surveyLink) return { ok: false, error: '설문 링크를 입력하세요.' };
  if (!deadline) return { ok: false, error: '마감일을 입력하세요.' };
  if (!Number.isFinite(maxParticipants) || maxParticipants <= 0) return { ok: false, error: '최종 모수(명)를 올바르게 입력하세요.' };

  const cpRes = readAdminCurrentParticipantsFromModal(maxParticipants);
  if (!cpRes.ok) return { ok: false, error: cpRes.error };

  const { participantGenders, participantAgeRanges, participantDevices } = readParticipantFieldsFromModal();

  const current = getStore(KEYS.listings, SAMPLE_LISTINGS) || [];
  const updated = current.map(l => l.id === id
    ? {
        ...l,
        title,
        category,
        estimatedTime,
        description,
        surveyLink,
        deadline,
        maxParticipants,
        currentParticipants: cpRes.currentParticipants,
        participantGenders,
        participantAgeRanges,
        participantDevices,
      }
    : l
  );
  setStore(KEYS.listings, updated);
  const listing = updated.find(l => l.id === id);
  return { ok: true, listing };
}

// ─── Profile Panel ───
function openProfilePanel() {
  const panel = document.getElementById('profile-panel');
  if (!panel) return;
  renderProfilePanel();
  panel.classList.add('open');
  document.getElementById('profile-backdrop').classList.remove('hidden');
}

function closeProfilePanel() {
  document.getElementById('profile-panel')?.classList.remove('open');
  document.getElementById('profile-backdrop')?.classList.add('hidden');
}

async function withdrawAccount() {
  if (!state.currentUser) return;
  if (!confirm('정말 탈퇴하시겠습니까? 계정과 관련 데이터가 삭제되며 복구할 수 없습니다.')) return;
  const email = state.currentUser.email;
  closeProfilePanel();
  await deleteUser(email);
  logout();
  showToast('탈퇴되었습니다.');
}

function renderProfilePanel() {
  const u = state.currentUser;
  if (!u || !document.getElementById('profile-form-inner')) return;

  const nameEl  = document.getElementById('panel-user-name-display');
  const emailEl = document.getElementById('panel-user-email-display');
  if (nameEl)  nameEl.textContent  = u.name  || '';
  if (emailEl) emailEl.textContent = u.email || '';

  document.getElementById('profile-name').value       = u.name       || '';
  document.getElementById('profile-birthdate').value  = u.birthdate  || '';
  document.getElementById('profile-gender').value     = u.gender     || '';
  document.getElementById('profile-job').value        = u.job        || '';
}

// ─── Modal ───
function openPayoutModal() {
  const amount = getUnpaidTotal();
  if (amount <= 0) {
    showToast('정산할 금액이 없습니다.');
    return;
  }

  document.getElementById('modal-amount').textContent = amount.toLocaleString();
  const u = getMergedCurrentUser();
  document.getElementById('payout-name').value = state.currentUser?.name || '';
  document.getElementById('payout-phone').value = '';
  document.getElementById('payout-bank').value = u?.bankName || '';
  document.getElementById('payout-account').value = u?.bankAccount || '';
  hideError('payout-error');
  document.getElementById('payout-modal').classList.remove('hidden');
}

function closePayoutModal() {
  document.getElementById('payout-modal').classList.add('hidden');
}

async function submitPayout() {
  const name = document.getElementById('payout-name').value.trim();
  const phone = document.getElementById('payout-phone').value.trim();
  const bankName = document.getElementById('payout-bank').value.trim();
  const bankAccount = document.getElementById('payout-account').value.trim();

  if (!name) { showError('payout-error', '이름을 입력하세요.'); return; }
  if (!phone) { showError('payout-error', '전화번호를 입력하세요.'); return; }
  if (!bankName) { showError('payout-error', '은행명을 입력하세요.'); return; }
  if (!bankAccount) { showError('payout-error', '계좌번호를 입력하세요.'); return; }

  hideError('payout-error');
  const btn = document.getElementById('btn-submit-payout');
  btn.disabled = true;
  btn.textContent = '처리 중...';

  const result = addPayout(name, phone, bankName, bankAccount);
  if (!result.ok) {
    showError('payout-error', result.error);
    btn.disabled = false;
    btn.textContent = '정산 요청하기';
    return;
  }

  await sendPayoutEmail(result.payout);

  btn.disabled = false;
  btn.textContent = '정산 요청하기';
  closePayoutModal();
  showToast('정산 요청이 접수되었습니다!');
  renderSettlement();
}

// ─── Event Listeners ───
function bindEvents() {
  // Login
  document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    hideError('login-error');
    if (!email || !password) {
      showError('login-error', '이메일과 비밀번호를 입력하세요.');
      return;
    }
    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span><span>로그인 중…</span>';
    const result = await login(email, password);
    btn.disabled = false;
    btn.textContent = '로그인';
    if (result.ok) {
      showView('app');
    } else {
      showError('login-error', result.error);
    }
  });

  // Enter key on login fields
  ['login-email', 'login-password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-login').click();
    });
  });

  // 이메일 인증번호 발송
  document.getElementById('btn-send-verify').addEventListener('click', async () => {
    const email = document.getElementById('reg-email').value.trim();
    hideError('register-error');
    const btn = document.getElementById('btn-send-verify');
    btn.disabled = true;
    btn.textContent = '발송 중...';
    const result = await sendEmailVerificationCode(email);
    btn.disabled = false;
    btn.textContent = '인증번호 받기';
    if (!result.ok) {
      showError('register-error', result.error);
      return;
    }
    document.getElementById('verify-code-wrap').classList.remove('hidden');
    document.getElementById('reg-verify-code').value = '';
    document.getElementById('reg-verify-code').focus();
    const hint = document.getElementById('verify-hint');
    hint.classList.remove('hidden');
    hint.textContent = `${email}로 인증번호를 발송했습니다. 이메일을 확인해 주세요. (10분 내 입력)`;
    showToast('인증번호가 이메일로 발송되었습니다.');
  });

  // Register
  document.getElementById('btn-register').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-password-confirm').value;

    hideError('register-error');
    if (!name || !email || !password || !confirm) {
      showError('register-error', '이름, 이메일, 비밀번호를 모두 입력하세요.');
      return;
    }
    if (!email.includes('@')) {
      showError('register-error', '올바른 이메일 주소를 입력하세요.');
      return;
    }
    if (password !== confirm) {
      showError('register-error', '비밀번호가 일치하지 않습니다.');
      return;
    }
    const agreedService = document.getElementById('reg-agree-service')?.checked;
    const agreedPrivacy = document.getElementById('reg-agree-privacy')?.checked;
    const agreedEmailNotice = document.getElementById('reg-agree-email-notice')?.checked;
    if (!agreedService || !agreedPrivacy || !agreedEmailNotice) {
      showError('register-error', '필수 동의 항목(약관/개인정보/이메일 알림)에 모두 동의해주세요.');
      return;
    }
    const btn = document.getElementById('btn-register');
    const setLoading = (msg) => {
      btn.disabled = true;
      btn.innerHTML = `<span class="btn-spinner"></span><span>${msg}</span>`;
    };
    setLoading('계정 생성 중…');
    const result = await register(name, email, password, '', '');
    if (result.ok) {
      setLoading('로그인 중…');
      await login(email, password);
      showView('app');
      showToast('회원가입이 완료되었습니다!');
    } else {
      btn.disabled = false;
      btn.textContent = '회원가입';
      showError('register-error', result.error);
    }
  });

  // Enter key on register fields
  ['reg-name', 'reg-phone', 'reg-verify-code', 'reg-email', 'reg-password', 'reg-password-confirm'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-register').click();
    });
  });

  // Toggle login/register
  document.getElementById('show-register').addEventListener('click', () => {
    showAuthForm('register');
    hideError('login-error');
    document.getElementById('verify-code-wrap').classList.add('hidden');
    document.getElementById('verify-hint').classList.add('hidden');
    syncRoute('login', 'register');
  });

  document.getElementById('show-login').addEventListener('click', () => {
    showAuthForm('login');
    hideError('register-error');
    syncRoute('login', 'login');
  });

  // 우측 상단 프로필: 항상 마이 페이지로 이동 (기본 정보는 마이 페이지의 버튼에서)
  document.getElementById('btn-profile').addEventListener('click', () => {
    closeProfilePanel();
    switchTab('settlement');
  });
  document.getElementById('btn-close-profile').addEventListener('click', closeProfilePanel);
  document.getElementById('profile-backdrop').addEventListener('click', closeProfilePanel);

  document.getElementById('btn-save-profile').addEventListener('click', async () => {
    const name      = document.getElementById('profile-name').value.trim();
    const birthdate = document.getElementById('profile-birthdate').value.trim();
    const gender    = document.getElementById('profile-gender').value;
    const job       = document.getElementById('profile-job').value.trim();
    if (!name) { showToast('이름을 입력하세요.'); return; }
    await saveProfile(name, birthdate, gender, job);
    showToast('프로필이 저장되었습니다!');
    closeProfilePanel();
  });

  document.getElementById('btn-withdraw').addEventListener('click', () => { withdrawAccount(); });
  document.getElementById('btn-edit-profile-inline')?.addEventListener('click', () => openProfilePanel());
  document.getElementById('btn-view-service-terms')?.addEventListener('click', () => openTermsModal('service'));
  document.getElementById('btn-view-privacy-terms')?.addEventListener('click', () => openTermsModal('privacy'));
  document.getElementById('btn-close-terms-modal')?.addEventListener('click', closeTermsModal);
  document.getElementById('terms-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeTermsModal();
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', logout);
  document.getElementById('btn-header-login').addEventListener('click', () => showView('login', { mode: 'login' }));
  document.getElementById('btn-back-to-listings').addEventListener('click', () => showView('app'));
  document.getElementById('btn-browse-listings-login')?.addEventListener('click', () => showView('app'));
  document.getElementById('btn-browse-listings-register')?.addEventListener('click', () => showView('app'));

  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    state.searchQuery = e.target.value;
    renderListings();
  });

  // Payout modal (정산받기 버튼 제거됨 — 모달은 필요 시 다른 진입점에서 사용 가능)
  document.getElementById('btn-close-modal').addEventListener('click', closePayoutModal);
  document.getElementById('btn-submit-payout').addEventListener('click', submitPayout);

  document.getElementById('payout-modal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closePayoutModal();
  });

  // Admin: Add listing
  const btnAdd = document.getElementById('btn-add-listing');
  if (btnAdd) btnAdd.addEventListener('click', openAddListingModal);
  const btnCloseAdd = document.getElementById('btn-close-add-listing');
  if (btnCloseAdd) btnCloseAdd.addEventListener('click', closeAddListingModal);
  const btnSubmitAdd = document.getElementById('btn-submit-add-listing');
  if (btnSubmitAdd) btnSubmitAdd.addEventListener('click', async () => {
    hideError('add-listing-error');
    const editId = document.getElementById('listing-edit-id')?.value;
    const result = editId ? updateListingFromModal() : createListingFromModal();
    if (!result.ok) {
      showError('add-listing-error', result.error);
      return;
    }
    closeAddListingModal();
    renderListings();
    showToast(editId ? '조사가 수정되었습니다.' : '조사가 추가되었습니다.');
    await upsertListingToSupabase(result.listing);
  });

  // 카드 수정 버튼 (이벤트 델리게이션)
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-edit-listing');
    if (btn) openEditListingModal(btn.dataset.id);
  });
  const addModal = document.getElementById('add-listing-modal');
  if (addModal) addModal.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeAddListingModal();
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePayoutModal();
      closeProfilePanel();
      closeAddListingModal();
      closeTermsModal();
    }
  });

  window.addEventListener('popstate', () => {
    const route = getRouteState();
    if (route.view === 'app') {
      showView('app', { syncHistory: false });
      return;
    }
    showView('login', { mode: route.mode, syncHistory: false });
  });
}

// ─── Init ───
async function init() {
  initData();
  trackLandingViewedOnce();
  // 세션·라우트 반영은 네트워크(sync)보다 먼저 — 그렇지 않으면 HTML 기본값(로그인 뷰)이 잠깐 보임(FOUC)
  checkSession();
  const route = getRouteState();
  if (state.currentUser) {
    showView('app', { replace: true });
  } else {
    // 비로그인 유저도 공고 카드는 열람 가능
    if (route.view === 'login') showView('login', { mode: route.mode, replace: true });
    else showView('app', { replace: true });
  }

  bindEvents();
  await syncUsersFromSupabase();
  await syncListingsFromSupabase();
  // 원격 데이터 반영 후 현재 탭만 다시 그리기
  switchTab(state.currentTab);
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => {
    console.error('init failed:', err);
  });
});
