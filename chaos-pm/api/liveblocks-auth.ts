import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromAuthHeader, supabaseAdmin } from '../lib/supabase-admin.js';
import { rateLimit, clientIp } from '../lib/rate-limit.js';

const LIVEBLOCKS_SECRET = process.env.LIVEBLOCKS_SECRET_KEY ?? '';

interface LiveblocksAuthRequest {
  room?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!LIVEBLOCKS_SECRET) {
    return res.status(500).json({ error: 'LIVEBLOCKS_SECRET_KEY not configured' });
  }

  // rate limit (per-IP, 30 req/min)
  const rl = rateLimit(`lb-auth:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return res.status(429).json({ error: 'rate limit exceeded' });

  const user = await getUserFromAuthHeader(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const { room } = (req.body ?? {}) as LiveblocksAuthRequest;
  if (!room || typeof room !== 'string') {
    return res.status(400).json({ error: 'room required' });
  }

  // Resolve canvas + user permission for this room
  const sb = supabaseAdmin();
  const { data: canvas, error: canvasErr } = await sb
    .from('canvases')
    .select('id, owner_id, share_token')
    .eq('liveblocks_room_id', room)
    .maybeSingle();

  if (canvasErr) return res.status(500).json({ error: 'lookup failed' });
  if (!canvas) return res.status(404).json({ error: 'room not found' });

  // Check membership; if not a member but has share_token, auto-add as viewer
  const { data: membership } = await sb
    .from('canvas_members')
    .select('role')
    .eq('canvas_id', canvas.id)
    .eq('user_id', user.id)
    .maybeSingle();

  let role: 'owner' | 'editor' | 'viewer' | null = (membership?.role as 'owner' | 'editor' | 'viewer' | null) ?? null;

  if (!role) {
    // Not a member. Allow auto-join only if there is a share_token (= shared canvas)
    if (!canvas.share_token) return res.status(403).json({ error: 'no access' });
    const { error: insErr } = await sb.from('canvas_members').insert({
      canvas_id: canvas.id,
      user_id: user.id,
      role: 'viewer',
    });
    if (insErr) return res.status(500).json({ error: 'join failed' });
    role = 'viewer';
  }

  // Determine Liveblocks permission
  const lbPermission = role === 'viewer' ? ['room:read', 'room:presence:write'] : ['room:write'];

  // Issue Liveblocks ID token
  const lbResp = await fetch('https://api.liveblocks.io/v2/authorize-user', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LIVEBLOCKS_SECRET}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: user.id,
      userInfo: { name: user.email.split('@')[0], color: pickColor(user.id) },
      permissions: { [room]: lbPermission },
    }),
  });

  if (!lbResp.ok) {
    const text = await lbResp.text();
    return res.status(502).json({ error: 'liveblocks auth failed', detail: text });
  }

  const json = await lbResp.json();
  return res.status(200).json(json);
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
function pickColor(id: string): string {
  let h = 0;
  for (const ch of id) h = ((h << 5) - h) + ch.charCodeAt(0);
  return COLORS[Math.abs(h) % COLORS.length];
}
