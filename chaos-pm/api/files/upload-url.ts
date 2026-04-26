import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserFromAuthHeader, supabaseAdmin } from '../../lib/supabase-admin.js';
import { rateLimit, clientIp } from '../../lib/rate-limit.js';
import crypto from 'node:crypto';

interface UploadReq {
  canvas_id?: string;
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
}

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
  'application/json', 'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const user = await getUserFromAuthHeader(req.headers.authorization);
  if (!user) return res.status(401).json({ error: 'unauthorized' });

  const rl = rateLimit(`upload:${user.id}`, 60, 60_000);
  if (!rl.ok) return res.status(429).json({ error: 'rate limit exceeded' });

  const { canvas_id, filename, mime_type, size_bytes } = (req.body ?? {}) as UploadReq;
  if (!canvas_id || !filename || !mime_type || typeof size_bytes !== 'number') {
    return res.status(400).json({ error: 'missing fields' });
  }
  if (size_bytes <= 0 || size_bytes > MAX_SIZE) {
    return res.status(413).json({ error: `size must be 1..${MAX_SIZE} bytes` });
  }
  if (!ALLOWED_MIME.has(mime_type)) {
    return res.status(415).json({ error: 'mime type not allowed' });
  }

  const sb = supabaseAdmin();
  const { data: canAccess } = await sb.rpc('has_canvas_access', {
    p_canvas: canvas_id,
    p_min_role: 'editor',
  });
  if (!canAccess) return res.status(403).json({ error: 'no access' });

  // sanitize filename, generate unique storage path
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  const fileId = crypto.randomUUID();
  const storagePath = `${user.id}/${canvas_id}/${fileId}-${safeName}`;

  // create signed upload url (Supabase Storage)
  const { data: signed, error: signErr } = await sb.storage
    .from('canvas-files')
    .createSignedUploadUrl(storagePath);

  if (signErr || !signed) return res.status(500).json({ error: 'sign failed' });

  // pre-register metadata (file row created on success-confirmation OR upfront with cleanup)
  const { error: insErr } = await sb.from('files').insert({
    id: fileId,
    owner_id: user.id,
    canvas_id,
    storage_path: storagePath,
    filename: safeName,
    mime_type,
    size_bytes,
  });
  if (insErr) return res.status(500).json({ error: 'metadata insert failed' });

  return res.status(200).json({
    file_id: fileId,
    storage_path: storagePath,
    upload_url: signed.signedUrl,
    token: signed.token,
  });
}
