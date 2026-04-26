-- ============================================================
-- Helper RPCs used by API routes
-- Run AFTER 0003_storage.sql
-- ============================================================

-- Retention: keep newest N snapshots per canvas
create or replace function public.purge_old_snapshots(p_canvas uuid, p_keep int default 50)
returns int language plpgsql security definer set search_path = public as $$
declare
  deleted_count int;
begin
  with ranked as (
    select id, row_number() over (order by created_at desc) as rn
    from public.canvas_snapshots
    where canvas_id = p_canvas
  )
  delete from public.canvas_snapshots cs
   using ranked r
   where cs.id = r.id and r.rn > p_keep
   returning 1 into deleted_count;

  return coalesce(deleted_count, 0);
end $$;

-- Allow client to call has_canvas_access via PostgREST too (optional convenience)
grant execute on function public.has_canvas_access(uuid, text) to authenticated;
grant execute on function public.purge_old_snapshots(uuid, int) to service_role;
