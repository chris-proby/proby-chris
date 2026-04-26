import { createClient, LiveObject } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';
import type { Widget, Connection } from './types';
import { getAccessToken, SUPABASE_CONFIGURED } from './supabase';

// Public key path is now legacy — kept only for local dev when Supabase isn't wired up.
const LEGACY_PUBLIC_KEY: string = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY ?? '';
const LB_AUTH_ENDPOINT = '/api/liveblocks-auth';

// Realtime collab is enabled when EITHER:
//   • Supabase is configured (production path: server-issued token), OR
//   • a legacy public key is present (dev fallback)
export const LIVEBLOCKS_KEY: string = SUPABASE_CONFIGURED ? 'auth-endpoint' : LEGACY_PUBLIC_KEY;

const client = SUPABASE_CONFIGURED
  ? createClient({
      authEndpoint: async (room) => {
        const token = await getAccessToken();
        if (!token) throw new Error('not authenticated');
        const r = await fetch(LB_AUTH_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ room }),
        });
        if (!r.ok) {
          const txt = await r.text().catch(() => '');
          throw new Error(`liveblocks auth failed: ${r.status} ${txt}`);
        }
        return await r.json();
      },
    })
  : LEGACY_PUBLIC_KEY
    ? createClient({ publicApiKey: LEGACY_PUBLIC_KEY })
    : null!;

export type Presence = {
  cursor: { x: number; y: number } | null;
  name: string;
  color: string;
};

export type CanvasSnapshot = {
  widgets: readonly Record<string, unknown>[];
  connections: readonly Record<string, unknown>[];
  maxZIndex: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Storage = { canvas: LiveObject<any> };

export const {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
  useUpdateMyPresence,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} = LIVEBLOCKS_KEY ? createRoomContext<Presence, Storage>(client) : ({} as ReturnType<typeof createRoomContext<Presence, Storage>>);

export { LiveObject };

export type CanvasData = { widgets: Widget[]; connections: Connection[]; maxZIndex: number };

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
export function getUserColor(userId: string): string {
  let h = 0;
  for (const ch of userId) h = ((h << 5) - h) + ch.charCodeAt(0);
  return COLORS[Math.abs(h) % COLORS.length];
}
