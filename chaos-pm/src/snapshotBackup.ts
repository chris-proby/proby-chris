import { getAccessToken, SUPABASE_CONFIGURED } from './supabase';
import type { Widget, Connection } from './types';

const SNAPSHOT_ENDPOINT = '/api/canvas/snapshot';

export interface SnapshotPayload {
  widgets: Widget[];
  connections: Connection[];
  maxZIndex: number;
}

export async function pushSnapshot(roomId: string, payload: SnapshotPayload): Promise<boolean> {
  if (!SUPABASE_CONFIGURED) return false;
  const token = await getAccessToken();
  if (!token) return false;

  // Strip transient fields and large file blobs (those go to Supabase Storage separately).
  const lean = stripForBackup(payload);

  try {
    const r = await fetch(SNAPSHOT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        room_id: roomId,
        widgets: lean.widgets,
        connections: lean.connections,
        max_z_index: lean.maxZIndex,
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function fetchLatestSnapshot(roomId: string): Promise<SnapshotPayload | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const r = await fetch(`${SNAPSHOT_ENDPOINT}?room_id=${encodeURIComponent(roomId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const json = await r.json();
    if (!json) return null;
    return {
      widgets: json.widgets ?? [],
      connections: json.connections ?? [],
      maxZIndex: json.max_z_index ?? 0,
    };
  } catch {
    return null;
  }
}

// Drop runtime-only fields and any inlined base64 data so the snapshot stays small.
// File data lives in Supabase Storage; widgets reference it by id/url.
function stripForBackup(p: SnapshotPayload): SnapshotPayload {
  const widgets = p.widgets.map((w) => {
    const data = (w.data ?? {}) as unknown as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      // drop large base64 blobs (legacy image src "data:image/...;base64,...")
      if (typeof v === 'string' && v.startsWith('data:') && v.length > 4_000) continue;
      cleaned[k] = v;
    }
    return { ...w, data: cleaned as unknown as Widget['data'] };
  });
  return { widgets, connections: p.connections, maxZIndex: p.maxZIndex };
}
