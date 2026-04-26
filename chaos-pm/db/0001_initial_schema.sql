-- ============================================================
-- chaos-pm initial schema
-- Run this in Supabase SQL editor (or via supabase migration)
-- ============================================================

-- enable extensions
create extension if not exists "pgcrypto";

-- ── profiles ──────────────────────────────────────────────────
-- 1:1 with auth.users; created via trigger on signup
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles(lower(email));

-- ── canvases ──────────────────────────────────────────────────
create table if not exists public.canvases (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users(id) on delete cascade,
  title               text not null default 'My Canvas',
  liveblocks_room_id  text not null unique,
  share_token         text unique,                       -- nullable; null = not shared
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists canvases_owner_idx on public.canvases(owner_id);
create index if not exists canvases_share_token_idx on public.canvases(share_token) where share_token is not null;

-- ── canvas_members (collaboration) ────────────────────────────
create table if not exists public.canvas_members (
  canvas_id   uuid not null references public.canvases(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('owner','editor','viewer')),
  invited_at  timestamptz not null default now(),
  primary key (canvas_id, user_id)
);

create index if not exists canvas_members_user_idx on public.canvas_members(user_id);

-- ── canvas_snapshots (server-side backup of Liveblocks state) ─
create table if not exists public.canvas_snapshots (
  id            uuid primary key default gen_random_uuid(),
  canvas_id     uuid not null references public.canvases(id) on delete cascade,
  widgets       jsonb not null,
  connections   jsonb not null,
  max_z_index   int  not null default 0,
  widget_count  int  generated always as (jsonb_array_length(widgets)) stored,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists canvas_snapshots_canvas_created_idx
  on public.canvas_snapshots(canvas_id, created_at desc);

-- ── files (metadata for Supabase Storage objects) ─────────────
create table if not exists public.files (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users(id) on delete cascade,
  canvas_id     uuid references public.canvases(id) on delete set null,
  storage_path  text not null,                   -- path inside the 'canvas-files' bucket
  filename      text not null,
  mime_type     text not null,
  size_bytes    int  not null,
  created_at    timestamptz not null default now()
);

create index if not exists files_owner_idx on public.files(owner_id);
create index if not exists files_canvas_idx on public.files(canvas_id);

-- ── audit_logs ────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id          bigserial primary key,
  user_id     uuid references auth.users(id) on delete set null,
  canvas_id   uuid references public.canvases(id) on delete set null,
  action      text not null,
  metadata    jsonb,
  ip_address  text,
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_user_idx     on public.audit_logs(user_id, created_at desc);
create index if not exists audit_logs_canvas_idx   on public.audit_logs(canvas_id, created_at desc);

-- ── triggers ──────────────────────────────────────────────────

-- updated_at auto-touch
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists canvases_set_updated_at on public.canvases;
create trigger canvases_set_updated_at
  before update on public.canvases
  for each row execute function public.set_updated_at();

-- create profile + default canvas on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  display_name text;
  new_canvas_id uuid;
begin
  display_name := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, email, name)
  values (new.id, new.email, display_name);

  -- one default canvas per new user (with default share_token = open invite link works)
  insert into public.canvases (owner_id, title, liveblocks_room_id, share_token)
  values (
    new.id,
    'My Canvas',
    'chaospm-' || new.id::text,
    encode(gen_random_bytes(16), 'hex')
  )
  returning id into new_canvas_id;

  insert into public.canvas_members (canvas_id, user_id, role)
  values (new_canvas_id, new.id, 'owner');

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
