-- ============================================================
-- Fix: handle_new_user trigger fails because gen_random_bytes
-- lives in the 'extensions' schema in Supabase, not public.
-- Replace with gen_random_uuid() (built-in, always available).
-- Run this AFTER the previous migrations.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  display_name text;
  new_canvas_id uuid;
begin
  display_name := coalesce(
    new.raw_user_meta_data->>'name',
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(coalesce(new.email, 'user'), '@', 1)
  );

  insert into public.profiles (id, email, name)
  values (new.id, coalesce(new.email, ''), display_name)
  on conflict (id) do nothing;

  -- one default canvas per new user; share_token uses gen_random_uuid (built-in)
  insert into public.canvases (owner_id, title, liveblocks_room_id, share_token)
  values (
    new.id,
    'My Canvas',
    'chaospm-' || new.id::text,
    replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', '')
  )
  on conflict (liveblocks_room_id) do nothing
  returning id into new_canvas_id;

  -- if conflict happened (re-trigger somehow), look up existing canvas
  if new_canvas_id is null then
    select id into new_canvas_id
      from public.canvases
     where liveblocks_room_id = 'chaospm-' || new.id::text
     limit 1;
  end if;

  if new_canvas_id is not null then
    insert into public.canvas_members (canvas_id, user_id, role)
    values (new_canvas_id, new.id, 'owner')
    on conflict (canvas_id, user_id) do nothing;
  end if;

  return new;
exception when others then
  -- never block auth.users insert because of our app-level setup
  raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  return new;
end $$;
