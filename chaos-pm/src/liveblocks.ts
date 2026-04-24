import { createClient, LiveObject } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';
import type { Widget, Connection } from './types';

export const LIVEBLOCKS_KEY: string = import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY ?? '';

const client = createClient({ publicApiKey: LIVEBLOCKS_KEY });

export type Presence = {
  cursor: { x: number; y: number } | null;
  name: string;
  color: string;
};

// Liveblocks requires storage types to satisfy LsonObject (JSON-serializable).
// We keep runtime Widget/Connection types in a separate alias and cast at the boundary.
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
} = createRoomContext<Presence, Storage>(client);

// Re-export for App.tsx
export { LiveObject };

// Typed helpers for reading/writing canvas data through the any-typed storage
export type CanvasData = { widgets: Widget[]; connections: Connection[]; maxZIndex: number };

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
export function getUserColor(userId: string): string {
  let h = 0;
  for (const ch of userId) h = ((h << 5) - h) + ch.charCodeAt(0);
  return COLORS[Math.abs(h) % COLORS.length];
}
