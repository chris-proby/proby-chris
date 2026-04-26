-- ============================================================
-- Helper RPC: latest snapshot per canvas (used by /api/cron/backup)
-- Run AFTER previous migrations.
-- ============================================================

create or replace function public.latest_snapshots_per_canvas()
returns table (
  id           uuid,
  canvas_id    uuid,
  widgets      jsonb,
  connections  jsonb,
  max_z_index  int,
  widget_count int,
  created_by   uuid,
  created_at   timestamptz
)
language sql
security definer
set search_path = public
as $$
  select distinct on (cs.canvas_id)
    cs.id, cs.canvas_id, cs.widgets, cs.connections, cs.max_z_index,
    cs.widget_count, cs.created_by, cs.created_at
  from public.canvas_snapshots cs
  order by cs.canvas_id, cs.created_at desc;
$$;

grant execute on function public.latest_snapshots_per_canvas() to service_role;
