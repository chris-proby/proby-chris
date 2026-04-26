import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromAuthHeader, supabaseAdmin, hasCanvasAccess } from '../../lib/supabase-admin.js';
import { rateLimit, clientIp } from '../../lib/rate-limit.js';
import crypto from 'node:crypto';

interface ShareRequest {
  canvas_id?: string;
  room_id?: string;
}

async function resolveCanvasId(
  sb: ReturnType<typeof supabaseAdmin>,
  canvasId: string | undefined,
  roomId: string | undefined,
): Promise<string | null> {
  if (canvasId) return canvasId;
  if (!roomId) return null;
  const { data } = await sb.from('canvases').select('id').eq('liveblocks_room_id', roomId).maybeSingle();
  return data?.id ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await getUserFromAuthHeader(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const sb = supabaseAdmin();

  if (req.method === 'GET') {
    const canvasId = await resolveCanvasId(
      sb,
      req.query.canvas_id ? String(req.query.canvas_id).trim() : undefined,
      req.query.room_id ? String(req.query.room_id).trim() : undefined,
    );
    if (!canvasId) return res.status(400).json({ error: 'canvas_id or room_id required' });

    const canAccess = await hasCanvasAccess(canvasId, user.id, 'viewer');
    if (!canAccess) return res.status(403).json({ error: 'no access' });

    const { data } = await sb.from('canvases').select('share_token').eq('id', canvasId).maybeSingle();
    return res.status(200).json({ share_token: data?.share_token ?? null });
  }

  if (req.method === 'POST') {
    // rotate / revoke share_token (owner only)
    const rl = rateLimit(`share-rotate:${user.id}`, 10, 60_000);
    if (!rl.ok) return res.status(429).json({ error: 'rate limit exceeded' });

    const body = (req.body ?? {}) as ShareRequest & { revoke?: boolean };
    const canvasId = await resolveCanvasId(sb, body.canvas_id, body.room_id);
    if (!canvasId) return res.status(400).json({ error: 'canvas_id or room_id required' });

    const isOwner = await hasCanvasAccess(canvasId, user.id, 'owner');
    if (!isOwner) return res.status(403).json({ error: 'owner only' });

    const newToken = body.revoke ? null : crypto.randomBytes(24).toString('hex');
    const { error } = await sb
      .from('canvases')
      .update({ share_token: newToken })
      .eq('id', canvasId);
    if (error) return res.status(500).json({ error: 'update failed' });

    return res.status(200).json({ share_token: newToken });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
