import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromAuthHeader, supabaseAdmin } from '../../lib/supabase-admin.js';
import { rateLimit, clientIp } from '../../lib/rate-limit.js';

interface SnapshotPayload {
  canvas_id?: string;
  widgets?: unknown[];
  connections?: unknown[];
  max_z_index?: number;
}

const MAX_WIDGETS = 5_000;
const MAX_CONNECTIONS = 20_000;
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getUserFromAuthHeader(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const sb = supabaseAdmin();

  if (req.method === 'GET') {
    const canvasId = String(req.query.canvas_id ?? '').trim();
    if (!canvasId) return res.status(400).json({ error: 'canvas_id required' });

    const { data: canAccess } = await sb.rpc('has_canvas_access', {
      p_canvas: canvasId,
      p_min_role: 'viewer',
    });
    if (!canAccess) return res.status(403).json({ error: 'no access' });

    const { data, error } = await sb
      .from('canvas_snapshots')
      .select('id, widgets, connections, max_z_index, created_at')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'lookup failed' });
    return res.status(200).json(data ?? null);
  }

  if (req.method === 'POST') {
    const rl = rateLimit(`snapshot:${user.id}:${clientIp(req)}`, 30, 60_000);
    if (!rl.ok) return res.status(429).json({ error: 'rate limit exceeded' });

    const body = req.body as SnapshotPayload;
    const { canvas_id, widgets, connections, max_z_index } = body ?? {};

    if (!canvas_id || typeof canvas_id !== 'string')
      return res.status(400).json({ error: 'canvas_id required' });
    if (!Array.isArray(widgets) || !Array.isArray(connections))
      return res.status(400).json({ error: 'widgets/connections must be arrays' });
    if (widgets.length > MAX_WIDGETS)
      return res.status(413).json({ error: `widgets exceeds ${MAX_WIDGETS}` });
    if (connections.length > MAX_CONNECTIONS)
      return res.status(413).json({ error: `connections exceeds ${MAX_CONNECTIONS}` });

    const payloadSize = Buffer.byteLength(JSON.stringify(body));
    if (payloadSize > MAX_PAYLOAD_BYTES)
      return res.status(413).json({ error: 'payload too large' });

    const { data: canAccess } = await sb.rpc('has_canvas_access', {
      p_canvas: canvas_id,
      p_min_role: 'editor',
    });
    if (!canAccess) return res.status(403).json({ error: 'no access' });

    const { error } = await sb.from('canvas_snapshots').insert({
      canvas_id,
      widgets,
      connections,
      max_z_index: typeof max_z_index === 'number' ? max_z_index : 0,
      created_by: user.id,
    });
    if (error) return res.status(500).json({ error: 'insert failed' });

    // best-effort retention: keep last 50 snapshots per canvas
    void sb.rpc('purge_old_snapshots', { p_canvas: canvas_id, p_keep: 50 }).then(() => {});

    return res.status(201).json({ ok: true });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}

export const config = {
  api: {
    bodyParser: { sizeLimit: '5mb' },
  },
};
