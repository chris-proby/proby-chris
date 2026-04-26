import { getAccessToken, getSupabase, SUPABASE_CONFIGURED } from './supabase';

const UPLOAD_URL_ENDPOINT = '/api/files/upload-url';
const STORAGE_BUCKET = 'canvas-files';

export interface UploadResult {
  id: string;
  url: string;
  storagePath: string;
}

interface PresignedUpload {
  file_id: string;
  storage_path: string;
  upload_url: string;
  token: string;
}

// Ask the server for a signed upload URL, then PUT the binary to Supabase Storage.
// Returns a public-fetchable URL (signed for 1 year).
export async function uploadFileToCloud(file: File, roomId: string): Promise<UploadResult> {
  if (!SUPABASE_CONFIGURED) {
    throw new Error('Supabase not configured');
  }
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error('not authenticated');

  // Look up canvas_id by room_id (server expects canvas_id)
  const canvasId = await resolveCanvasIdByRoom(roomId);
  if (!canvasId) throw new Error('canvas not found');

  // 1. ask server for a presigned upload URL (this also creates the metadata row)
  const presignRes = await fetch(UPLOAD_URL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      canvas_id: canvasId,
      filename: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    }),
  });
  if (!presignRes.ok) {
    const txt = await presignRes.text().catch(() => '');
    throw new Error(`presign failed: ${presignRes.status} ${txt}`);
  }
  const presigned = (await presignRes.json()) as PresignedUpload;

  // 2. upload the binary directly to Supabase Storage
  const sb = getSupabase();
  const { error: upErr } = await sb.storage
    .from(STORAGE_BUCKET)
    .uploadToSignedUrl(presigned.storage_path, presigned.token, file, {
      contentType: file.type || 'application/octet-stream',
    });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);

  // 3. create a long-lived signed URL for read access (1 year)
  const { data: signed, error: signErr } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(presigned.storage_path, 60 * 60 * 24 * 365);
  if (signErr || !signed) throw new Error(`sign read url failed: ${signErr?.message}`);

  return {
    id: presigned.file_id,
    url: signed.signedUrl,
    storagePath: presigned.storage_path,
  };
}

// Refresh a signed URL when it expires (or before).
export async function refreshSignedUrl(storagePath: string): Promise<string | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const sb = getSupabase();
  const { data } = await sb.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);
  return data?.signedUrl ?? null;
}

async function resolveCanvasIdByRoom(roomId: string): Promise<string | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const sb = getSupabase();
  const { data } = await sb
    .from('canvases')
    .select('id')
    .eq('liveblocks_room_id', roomId)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
