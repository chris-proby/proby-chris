-- ═══════════════════════════════════════════════════════
-- Backfill / 수정: 권해솜 — panel_completed 사례비 (Supabase SQL Editor)
-- ═══════════════════════════════════════════════════════
-- 사례비 (고정):
--   · 음료 브랜드에 대한 의견을 들려주세요     → 1,000원
--   · 은행 앱의 디자인을 평가해주세요~         → 5,000원
--   합계 6,000원
--
-- 실행 전 확인:
--   SELECT email, name FROM public.panel_users WHERE name = '권해솜';
--   SELECT id, title, reward FROM public.panel_listings
--   WHERE title ILIKE '%음료 브랜드%' OR title ILIKE '%은행 앱%디자인%';

-- ─── 1) 이미 들어간 행의 reward 정정 (panel_listings 제목 기준, 먼저 실행 권장) ───
UPDATE public.panel_completed AS c
SET
  reward = CASE
    WHEN l.title ILIKE '%은행 앱의 디자인을 평가해주세요%' THEN 5000
    WHEN l.title ILIKE '%음료 브랜드에 대한 의견을 들려주세요%' THEN 1000
    ELSE c.reward
  END,
  title = l.title
FROM public.panel_listings AS l
WHERE c.listing_id = l.id
  AND c.user_email IN (SELECT email FROM public.panel_users WHERE name = '권해솜');

-- ─── 2) 없으면 삽입, 있으면 올바른 금액으로 갱신 ───
INSERT INTO public.panel_completed (user_email, listing_id, reward, title)
SELECT
  u.email,
  l.id,
  CASE
    WHEN l.title ILIKE '%은행 앱의 디자인을 평가해주세요%' THEN 5000
    WHEN l.title ILIKE '%음료 브랜드에 대한 의견을 들려주세요%' THEN 1000
    ELSE COALESCE(NULLIF(l.reward, 0), 0)
  END,
  l.title
FROM public.panel_users AS u
INNER JOIN public.panel_listings AS l ON (
  l.title ILIKE '%음료 브랜드에 대한 의견을 들려주세요%'
  OR l.title ILIKE '%은행 앱의 디자인을 평가해주세요%'
)
WHERE u.name = '권해솜'
ON CONFLICT (user_email, listing_id) DO UPDATE SET
  reward = EXCLUDED.reward,
  title  = EXCLUDED.title;

-- 동명이인이 있으면 위 INSERT가 여러 행을 만들 수 있음.
-- 그 경우 아래처럼 이메일을 고정해 실행하세요.

/*
INSERT INTO public.panel_completed (user_email, listing_id, reward, title)
SELECT
  '권해솜실제이메일@example.com',
  l.id,
  CASE
    WHEN l.title ILIKE '%은행 앱의 디자인을 평가해주세요%' THEN 5000
    WHEN l.title ILIKE '%음료 브랜드에 대한 의견을 들려주세요%' THEN 1000
    ELSE COALESCE(NULLIF(l.reward, 0), 0)
  END,
  l.title
FROM public.panel_listings AS l
WHERE l.title ILIKE '%음료 브랜드에 대한 의견을 들려주세요%'
   OR l.title ILIKE '%은행 앱의 디자인을 평가해주세요%'
ON CONFLICT (user_email, listing_id) DO UPDATE SET
  reward = EXCLUDED.reward,
  title = EXCLUDED.title;
*/
