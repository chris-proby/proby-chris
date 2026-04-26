-- ============================================================
-- Row Level Security policies
-- Run AFTER 0001_initial_schema.sql
-- ============================================================

alter table public.profiles         enable row level security;
alter table public.canvases         enable row level security;
alter table public.canvas_members   enable row level security;
alter table public.canvas_snapshots enable row level security;
alter table public.files            enable row level security;
alter table public.audit_logs       enable row level security;

-- ── helper: does the current user have access to a canvas? ──
create or replace function public.has_canvas_access(p_canvas uuid, p_min_role text default 'viewer')
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.canvas_members m
    where m.canvas_id = p_canvas
      and m.user_id   = auth.uid()
      and (
        p_min_role = 'viewer'
        or (p_min_role = 'editor' and m.role in ('owner','editor'))
        or (p_min_role = 'owner'  and m.role = 'owner')
      )
  );
$$;

-- ── profiles ────────────────────────────────────────────────
drop policy if exists "profiles read own"      on public.profiles;
drop policy if exists "profiles update own"    on public.profiles;
drop policy if exists "profiles read members"  on public.profiles;

create policy "profiles read own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles update own" on public.profiles
  for update using (id = auth.uid());

-- allow seeing names of co-members
create policy "profiles read members" on public.profiles
  for select using (
    exists (
      select 1
      from public.canvas_members me
      join public.canvas_members peer on peer.canvas_id = me.canvas_id
      where me.user_id = auth.uid() and peer.user_id = public.profiles.id
    )
  );

-- ── canvases ────────────────────────────────────────────────
drop policy if exists "canvases read members"   on public.canvases;
drop policy if exists "canvases update editors" on public.canvases;
drop policy if exists "canvases insert self"    on public.canvases;
drop policy if exists "canvases delete owner"   on public.canvases;

create policy "canvases read members" on public.canvases
  for select using (public.has_canvas_access(id, 'viewer'));

create policy "canvases update editors" on public.canvases
  for update using (public.has_canvas_access(id, 'editor'));

create policy "canvases insert self" on public.canvases
  for insert with check (owner_id = auth.uid());

create policy "canvases delete owner" on public.canvases
  for delete using (owner_id = auth.uid());

-- ── canvas_members ──────────────────────────────────────────
drop policy if exists "members read related"   on public.canvas_members;
drop policy if exists "members manage by owner" on public.canvas_members;
drop policy if exists "members self read"      on public.canvas_members;

create policy "members read related" on public.canvas_members
  for select using (public.has_canvas_access(canvas_id, 'viewer'));

create policy "members manage by owner" on public.canvas_members
  for all using (public.has_canvas_access(canvas_id, 'owner'))
        with check (public.has_canvas_access(canvas_id, 'owner'));

-- ── canvas_snapshots ────────────────────────────────────────
drop policy if exists "snapshots read members"  on public.canvas_snapshots;
drop policy if exists "snapshots insert editor" on public.canvas_snapshots;

create policy "snapshots read members" on public.canvas_snapshots
  for select using (public.has_canvas_access(canvas_id, 'viewer'));

create policy "snapshots insert editor" on public.canvas_snapshots
  for insert with check (
    public.has_canvas_access(canvas_id, 'editor')
    and (created_by is null or created_by = auth.uid())
  );

-- ── files ───────────────────────────────────────────────────
drop policy if exists "files read access"   on public.files;
drop policy if exists "files insert owner"  on public.files;
drop policy if exists "files delete owner"  on public.files;

create policy "files read access" on public.files
  for select using (
    owner_id = auth.uid()
    or (canvas_id is not null and public.has_canvas_access(canvas_id, 'viewer'))
  );

create policy "files insert owner" on public.files
  for insert with check (owner_id = auth.uid());

create policy "files delete owner" on public.files
  for delete using (owner_id = auth.uid());

-- ── audit_logs (read-only for users; writes via service role only) ──
drop policy if exists "audit read own" on public.audit_logs;

create policy "audit read own" on public.audit_logs
  for select using (
    user_id = auth.uid()
    or (canvas_id is not null and public.has_canvas_access(canvas_id, 'owner'))
  );
-- inserts intentionally allowed only via service role (no insert policy)
