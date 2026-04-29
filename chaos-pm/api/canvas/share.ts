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

    const { data } = await sb.from('canvases').select('share_token, share_role').eq('id', canvasId).maybeSingle();
    return res.status(200).json({
      share_token: data?.share_token ?? null,
      share_role: (data?.share_role as 'editor' | 'viewer' | undefined) ?? 'editor',
    });
  }

  if (req.method === 'POST') {
    // rotate / revoke share_token + optionally update share_role (owner only)
    const rl = rateLimit(`share-rotate:${user.id}`, 10, 60_000);
    if (!rl.ok) return res.status(429).json({ error: 'rate limit exceeded' });

    const body = (req.body ?? {}) as ShareRequest & {
      revoke?: boolean;
      share_role?: 'editor' | 'viewer';
      rotate?: boolean;
    };
    const canvasId = await resolveCanvasId(sb, body.canvas_id, body.room_id);
    if (!canvasId) return res.status(400).json({ error: 'canvas_id or room_id required' });

    const isOwner = await hasCanvasAccess(canvasId, user.id, 'owner');
    if (!isOwner) return res.status(403).json({ error: 'owner only' });

    // build update: rotate token only if explicitly requested OR revoking
    const update: Record<string, unknown> = {};
    if (body.revoke) {
      update.share_token = null;
    } else if (body.rotate || body.share_token === null) {
      update.share_token = crypto.randomBytes(24).toString('hex');
    }
    if (body.share_role && (body.share_role === 'editor' || body.share_role === 'viewer')) {
      update.share_role = body.share_role;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'nothing to update' });
    }

    const { data: updated, error } = await sb
      .from('canvases')
      .update(update)
      .eq('id', canvasId)
      .select('share_token, share_role')
      .maybeSingle();
    if (error) return res.status(500).json({ error: 'update failed' });

    let evicted = 0;
    if (body.revoke) {
      // also evict every member except the owner so existing guests lose access
      const { count, error: delErr } = await sb
        .from('canvas_members')
        .delete({ count: 'exact' })
        .eq('canvas_id', canvasId)
        .neq('user_id', user.id);
      if (delErr) return res.status(500).json({ error: 'evict failed' });
      evicted = count ?? 0;
    }

    return res.status(200).json({
      share_token: updated?.share_token ?? null,
      share_role: updated?.share_role ?? 'editor',
      evicted,
    });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
