import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromAuthHeader, supabaseAdmin, hasCanvasAccess } from '../../lib/supabase-admin.js';
import { rateLimit, clientIp } from '../../lib/rate-limit.js';

type Role = 'owner' | 'editor' | 'viewer';
const ALLOWED_ROLES: Role[] = ['editor', 'viewer'];

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
  const canvasId = await resolveCanvasId(
    sb,
    (req.query.canvas_id ?? (req.body as { canvas_id?: string } | undefined)?.canvas_id) as string | undefined,
    (req.query.room_id ?? (req.body as { room_id?: string } | undefined)?.room_id) as string | undefined,
  );
  if (!canvasId) return res.status(400).json({ error: 'canvas_id or room_id required' });

  // ── GET: list members + pending invites (any member can see) ──
  if (req.method === 'GET') {
    const canSee = await hasCanvasAccess(canvasId, user.id, 'viewer');
    if (!canSee) return res.status(403).json({ error: 'no access' });

    const { data: members } = await sb
      .from('canvas_members')
      .select('user_id, role, invited_at, profiles!inner(email, name)')
      .eq('canvas_id', canvasId);

    const { data: pending } = await sb
      .from('pending_invites')
      .select('id, email, role, created_at')
      .eq('canvas_id', canvasId);

    return res.status(200).json({
      members: (members ?? []).map((m: Record<string, unknown>) => {
        const p = m.profiles as { email?: string; name?: string } | null;
        return {
          user_id: m.user_id,
          role: m.role,
          email: p?.email ?? '',
          name: p?.name ?? '',
          invited_at: m.invited_at,
        };
      }),
      pending: pending ?? [],
    });
  }

  // mutating ops: owner only + rate limit
  const isOwner = await hasCanvasAccess(canvasId, user.id, 'owner');
  if (!isOwner) return res.status(403).json({ error: 'owner only' });

  const rl = rateLimit(`members:${user.id}:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return res.status(429).json({ error: 'rate limit exceeded' });

  // ── POST: invite by email ──
  if (req.method === 'POST') {
    const body = (req.body ?? {}) as { email?: string; role?: Role };
    const email = (body.email ?? '').trim().toLowerCase();
    const role = body.role;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid email' });
    }
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'role must be editor or viewer' });
    }
    if (email === user.email.toLowerCase()) {
      return res.status(400).json({ error: 'cannot invite yourself' });
    }

    // try to find an existing profile by email
    const { data: profile } = await sb
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (profile?.id) {
      const { error } = await sb
        .from('canvas_members')
        .upsert(
          { canvas_id: canvasId, user_id: profile.id, role },
          { onConflict: 'canvas_id,user_id' },
        );
      if (error) return res.status(500).json({ error: 'invite failed' });
      return res.status(200).json({ status: 'added', role });
    }

    // user doesn't exist yet → store as pending invite
    const { error } = await sb
      .from('pending_invites')
      .upsert(
        { canvas_id: canvasId, email, role, invited_by: user.id },
        { onConflict: 'canvas_id,email' },
      );
    if (error) return res.status(500).json({ error: 'pending invite failed' });
    return res.status(200).json({ status: 'pending', role });
  }

  // ── PATCH: update role of an existing member ──
  if (req.method === 'PATCH') {
    const body = (req.body ?? {}) as { user_id?: string; role?: Role };
    const targetId = body.user_id;
    const role = body.role;
    if (!targetId) return res.status(400).json({ error: 'user_id required' });
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'role must be editor or viewer' });
    }
    if (targetId === user.id) {
      return res.status(400).json({ error: 'cannot change own role' });
    }

    const { error } = await sb
      .from('canvas_members')
      .update({ role })
      .eq('canvas_id', canvasId)
      .eq('user_id', targetId)
      .neq('role', 'owner'); // never demote owner via this path
    if (error) return res.status(500).json({ error: 'update failed' });
    return res.status(200).json({ status: 'updated', role });
  }

  // ── DELETE: remove member or pending invite ──
  if (req.method === 'DELETE') {
    const body = (req.body ?? {}) as { user_id?: string; pending_id?: string };
    const targetId = body.user_id;
    const pendingId = body.pending_id;

    if (pendingId) {
      const { error } = await sb
        .from('pending_invites')
        .delete()
        .eq('id', pendingId)
        .eq('canvas_id', canvasId);
      if (error) return res.status(500).json({ error: 'delete failed' });
      return res.status(200).json({ status: 'removed_pending' });
    }

    if (!targetId) return res.status(400).json({ error: 'user_id or pending_id required' });
    if (targetId === user.id) {
      return res.status(400).json({ error: 'cannot remove yourself (delete the canvas instead)' });
    }
    const { error } = await sb
      .from('canvas_members')
      .delete()
      .eq('canvas_id', canvasId)
      .eq('user_id', targetId)
      .neq('role', 'owner');
    if (error) return res.status(500).json({ error: 'delete failed' });
    return res.status(200).json({ status: 'removed' });
  }

  res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
  return res.status(405).json({ error: 'method not allowed' });
}
