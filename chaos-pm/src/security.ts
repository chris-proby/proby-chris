// URL safety helpers — block dangerous schemes (javascript:/data:/file:/vbscript:)
// and prevent same-origin embed escalation.

const DANGEROUS_SCHEMES = ['javascript:', 'vbscript:', 'data:', 'file:', 'blob:'];
const ALLOWED_EMBED_PROTOCOLS = new Set(['http:', 'https:']);

export function isSafeHref(raw: string): boolean {
  if (!raw) return false;
  const s = raw.trim().toLowerCase();
  if (DANGEROUS_SCHEMES.some((scheme) => s.startsWith(scheme))) return false;
  // mailto:, tel:, /relative-path, https://, http:// are all OK
  return true;
}

export function safeHref(raw: string, fallback = '#'): string {
  return isSafeHref(raw) ? raw : fallback;
}

// Embed iframe URL must be https/http AND not the chaos-pm origin itself
// (otherwise allow-same-origin sandbox would let it read parent localStorage).
export function isSafeEmbedUrl(raw: string): boolean {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (!ALLOWED_EMBED_PROTOCOLS.has(url.protocol)) return false;
  if (typeof window !== 'undefined') {
    if (url.origin === window.location.origin) return false;
  }
  return true;
}
