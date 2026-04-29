-- ============================================================
-- 0007: Email-based invites + share-link role selection
-- Run after 0006_backup_helpers.sql
-- ============================================================

-- ── canvases.share_role ──────────────────────────────────────
-- Default role granted when a non-member joins via share_token.
-- Existing rows default to 'editor' (so the share link is useful
-- for collab out of the box).
alter table public.canvases
  add column if not exists share_role text not null default 'editor'
    check (share_role in ('editor','viewer'));

-- ── pending_invites ──────────────────────────────────────────
-- Email invites for users who don't have an account yet. When
-- they sign up, the trigger below converts pending_invites rows
-- into canvas_members rows automatically.
create table if not exists public.pending_invites (
  id          uuid primary key default gen_random_uuid(),
  canvas_id   uuid not null references public.canvases(id) on delete cascade,
  email       text not null,
  role        text not null check (role in ('editor','viewer')),
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (canvas_id, email)
);

create index if not exists pending_invites_email_idx
  on public.pending_invites (lower(email));

alter table public.pending_invites enable row level security;

drop policy if exists "pending_invites read by owner" on public.pending_invites;
drop policy if exists "pending_invites write by owner" on public.pending_invites;

create policy "pending_invites read by owner" on public.pending_invites
  for select using (public.has_canvas_access(canvas_id, 'owner'));

create policy "pending_invites write by owner" on public.pending_invites
  for all using (public.has_canvas_access(canvas_id, 'owner'))
        with check (public.has_canvas_access(canvas_id, 'owner'));

-- ── trigger: on signup, claim any pending invites for this email ──
create or replace function public.claim_pending_invites()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null then return new; end if;

  insert into public.canvas_members (canvas_id, user_id, role)
  select pi.canvas_id, new.id, pi.role
    from public.pending_invites pi
   where lower(pi.email) = lower(new.email)
  on conflict (canvas_id, user_id) do nothing;

  delete from public.pending_invites where lower(email) = lower(new.email);

  return new;
exception when others then
  raise warning 'claim_pending_invites failed for %: %', new.id, sqlerrm;
  return new;
end $$;

drop trigger if exists on_auth_user_claim_invites on auth.users;
create trigger on_auth_user_claim_invites
  after insert on auth.users
  for each row execute function public.claim_pending_invites();
