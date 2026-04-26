import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  // Defer error until first call so module import doesn't crash entire serverless bundle
  console.warn('[supabase-admin] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
}

let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// Verify a user JWT (from Authorization: Bearer <token>) and return the user.
// Returns null on any failure.
export async function getUserFromAuthHeader(authHeader: string | undefined): Promise<{
  id: string;
  email: string;
} | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token) return null;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? '' };
}

// Check whether `userId` has at least `minRole` on `canvasId`.
// Use this from API routes — the SQL has_canvas_access RPC uses auth.uid()
// which is NULL when called via service_role.
export type CanvasRole = 'owner' | 'editor' | 'viewer';
export async function hasCanvasAccess(
  canvasId: string,
  userId: string,
  minRole: CanvasRole = 'viewer',
): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from('canvas_members')
    .select('role')
    .eq('canvas_id', canvasId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return false;
  const role = data.role as CanvasRole;
  if (minRole === 'viewer') return true;
  if (minRole === 'editor') return role === 'owner' || role === 'editor';
  return role === 'owner';
}
