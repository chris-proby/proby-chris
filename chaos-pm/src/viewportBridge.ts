import type { Viewport } from './types';

// Always-current viewport — updated by Canvas on every pan/zoom frame.
// WidgetNode reads this instead of useStore.getState().viewport
// so that drag behavior is correct even during debounced zoom.
export const vpBridge: Viewport = { x: 0, y: 0, scale: 1 };

// Keyboard state bridge — lets Canvas and WidgetNode share key state without React.
export const keyBridge = { space: false };
