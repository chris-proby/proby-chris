-- 1. companies 테이블
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#6366f1',
  secondary_color TEXT NOT NULL DEFAULT '#8b5cf6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. profiles 테이블
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin','editor','viewer')),
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. folders 테이블
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. files 테이블
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  file_size BIGINT NOT NULL DEFAULT 0,
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'files',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 신규 유저 프로필 자동생성 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 6. RLS 활성화
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- 7. RLS 정책: profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Super admin sees all profiles" ON profiles FOR ALL USING ((SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true);

-- 8. RLS 정책: companies
CREATE POLICY "Users see own company" ON companies FOR SELECT USING (
  id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Super admin manages all companies" ON companies FOR ALL USING (
  (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
);

-- 9. RLS 정책: folders
CREATE POLICY "Users see own company folders" ON folders FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Super admin manages all folders" ON folders FOR ALL USING (
  (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
);

-- 10. RLS 정책: files
CREATE POLICY "Users see own company files" ON files FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Super admin manages all files" ON files FOR ALL USING (
  (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
);

-- 11. dashboard_widgets 테이블
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  redirect_url TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own company widgets" ON dashboard_widgets FOR SELECT USING (
  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Super admin manages all widgets" ON dashboard_widgets FOR ALL USING (
  (SELECT is_super_admin FROM profiles WHERE id = auth.uid()) = true
);
