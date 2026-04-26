// Mixpanel SDK is lazy-loaded so it doesn't block the critical path.
// Calls before init are queued and flushed once the SDK arrives.

type MixpanelLike = {
  init: (token: string, opts: Record<string, unknown>) => void;
  identify: (id: string) => void;
  people: { set: (props: Record<string, unknown>) => void };
  reset: () => void;
  track: (event: string, props?: Record<string, unknown>) => void;
};

const TOKEN = 'b500853bd0fa70e8e5e528b81ecd6d62';

let mp: MixpanelLike | null = null;
let loadPromise: Promise<MixpanelLike> | null = null;
const queue: Array<(m: MixpanelLike) => void> = [];

function ensureLoaded(): Promise<MixpanelLike> {
  if (mp) return Promise.resolve(mp);
  if (loadPromise) return loadPromise;
  loadPromise = import('mixpanel-browser').then((mod) => {
    const m = (mod.default ?? mod) as MixpanelLike;
    m.init(TOKEN, {
      track_pageview: false,
      persistence: 'localStorage',
      ignore_dnt: true,
    });
    mp = m;
    // flush queued calls
    while (queue.length) queue.shift()!(m);
    return m;
  });
  return loadPromise;
}

// Defer initial SDK fetch to idle time
if (typeof window !== 'undefined') {
  const idle = (cb: () => void) =>
    'requestIdleCallback' in window
      ? (window as Window & typeof globalThis).requestIdleCallback(cb, { timeout: 4000 })
      : setTimeout(cb, 2000);
  idle(() => { void ensureLoaded(); });
}

function enqueue(fn: (m: MixpanelLike) => void): void {
  if (mp) { fn(mp); return; }
  queue.push(fn);
  void ensureLoaded();
}

export function analyticsIdentify(email: string, props?: { name?: string; createdAt?: number }) {
  enqueue((m) => {
    m.identify(email);
    m.people.set({
      $email: email,
      $name: props?.name ?? email,
      ...(props?.createdAt ? { $created: new Date(props.createdAt).toISOString() } : {}),
    });
  });
}

export function analyticsReset() {
  enqueue((m) => m.reset());
}

export function track(event: string, props?: Record<string, unknown>) {
  enqueue((m) => m.track(event, props));
}
