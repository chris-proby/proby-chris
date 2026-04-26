import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/supabase-admin.js';

// Daily backup of critical metadata tables to Supabase Storage.
// Triggered by Vercel Cron at the schedule defined in vercel.json.
// Vercel injects `Authorization: Bearer <CRON_SECRET>` automatically
// when CRON_SECRET env var is set on the project — we verify it here.

const CRON_SECRET = process.env.CRON_SECRET ?? '';
const BACKUP_BUCKET = 'canvas-files';
const RETENTION_DAYS = 30;

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth: must come from Vercel Cron (or admin with the secret)
  const auth = req.headers.authorization ?? '';
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const sb = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const startedAt = Date.now();

  try {
    // Export each table page-by-page to keep memory bounded.
    const profiles = await dumpTable(sb, 'profiles');
    const canvases = await dumpTable(sb, 'canvases');
    const members = await dumpTable(sb, 'canvas_members');
    const files = await dumpTable(sb, 'files');

    // Snapshots can be huge; only back up the latest snapshot per canvas.
    const { data: latestSnapshots } = await sb.rpc('latest_snapshots_per_canvas');

    const payload = {
      backup_date: today,
      generated_at: new Date().toISOString(),
      counts: {
        profiles: profiles.length,
        canvases: canvases.length,
        members: members.length,
        files: files.length,
        latest_snapshots: latestSnapshots?.length ?? 0,
      },
      profiles,
      canvases,
      canvas_members: members,
      files,
      latest_snapshots: latestSnapshots ?? [],
    };

    const path = `_backups/${today}/full-${Date.now()}.json`;
    const body = JSON.stringify(payload);

    const { error: upErr } = await sb.storage
      .from(BACKUP_BUCKET)
      .upload(path, body, {
        contentType: 'application/json',
        upsert: true,
      });
    if (upErr) throw new Error(`upload failed: ${upErr.message}`);

    // Best-effort retention cleanup
    void purgeOldBackups(sb).catch(() => {});

    return res.status(200).json({
      ok: true,
      path,
      bytes: body.length,
      counts: payload.counts,
      duration_ms: Date.now() - startedAt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'backup failed', detail: msg });
  }
}

async function dumpTable(sb: ReturnType<typeof supabaseAdmin>, table: string): Promise<unknown[]> {
  const PAGE = 1000;
  let from = 0;
  const all: unknown[] = [];
  while (true) {
    const { data, error } = await sb.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} dump: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function purgeOldBackups(sb: ReturnType<typeof supabaseAdmin>): Promise<void> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data: folders } = await sb.storage.from(BACKUP_BUCKET).list('_backups');
  if (!folders) return;

  const toRemove: string[] = [];
  for (const folder of folders) {
    if (folder.name < cutoff) {
      const { data: files } = await sb.storage
        .from(BACKUP_BUCKET)
        .list(`_backups/${folder.name}`);
      if (files) toRemove.push(...files.map((f) => `_backups/${folder.name}/${f.name}`));
    }
  }
  if (toRemove.length) await sb.storage.from(BACKUP_BUCKET).remove(toRemove);
}
