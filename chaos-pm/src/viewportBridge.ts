import type { Viewport } from './types';

// Always-current viewport — updated by Canvas on every pan/zoom frame.
// WidgetNode reads this instead of useStore.getState().viewport
// so that drag behavior is correct even during debounced zoom.
export const vpBridge: Viewport = { x: 0, y: 0, scale: 1 };

// Keyboard state bridge — lets Canvas and WidgetNode share key state without React.
export const keyBridge = { space: false };

// Collab bridge — Canvas writes cursor world-coords here; CollabSync forwards to Liveblocks presence.
export const collabBridge = {
  onCursorMove: null as ((x: number, y: number) => void) | null,
};

// Current Liveblocks room ID — set by App.tsx after session is established.
// Used by file upload handlers to attach files to the correct canvas.
export const roomBridge = { current: null as string | null };
