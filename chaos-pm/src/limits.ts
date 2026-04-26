// Centralized client-side resource limits.
// Server enforces stricter caps in /api/canvas/snapshot and /api/files/upload-url.

export const LIMITS = {
  MAX_WIDGETS_PER_CANVAS: 1_000,
  MAX_CONNECTIONS_PER_CANVAS: 5_000,
  MAX_TEXT_LENGTH: 50_000,                 // notes, textbox, html source
  MAX_TITLE_LENGTH: 200,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,   // 10MB (matches server)
  MAX_IMAGE_DIMENSION: 8_000,              // px, prevents pathological images
  MAX_FILES_PER_WIDGET: 50,
};

export type LimitName = keyof typeof LIMITS;

export interface LimitError {
  limit: LimitName;
  current: number;
  max: number;
  message: string;
}

export function checkWidgetCount(currentCount: number): LimitError | null {
  if (currentCount >= LIMITS.MAX_WIDGETS_PER_CANVAS) {
    return {
      limit: 'MAX_WIDGETS_PER_CANVAS',
      current: currentCount,
      max: LIMITS.MAX_WIDGETS_PER_CANVAS,
      message: `위젯 한도(${LIMITS.MAX_WIDGETS_PER_CANVAS}개)에 도달했습니다`,
    };
  }
  return null;
}

export function checkConnectionCount(currentCount: number): LimitError | null {
  if (currentCount >= LIMITS.MAX_CONNECTIONS_PER_CANVAS) {
    return {
      limit: 'MAX_CONNECTIONS_PER_CANVAS',
      current: currentCount,
      max: LIMITS.MAX_CONNECTIONS_PER_CANVAS,
      message: `연결선 한도(${LIMITS.MAX_CONNECTIONS_PER_CANVAS}개)에 도달했습니다`,
    };
  }
  return null;
}

export function checkFileSize(bytes: number): LimitError | null {
  if (bytes > LIMITS.MAX_FILE_SIZE_BYTES) {
    return {
      limit: 'MAX_FILE_SIZE_BYTES',
      current: bytes,
      max: LIMITS.MAX_FILE_SIZE_BYTES,
      message: `파일 크기 한도(${(LIMITS.MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0)}MB)를 초과했습니다`,
    };
  }
  return null;
}

export function clampText(text: string, max = LIMITS.MAX_TEXT_LENGTH): string {
  if (text.length <= max) return text;
  return text.slice(0, max);
}

// Lightweight toast — falls back to alert when no toast UI is available.
let toastFn: ((msg: string) => void) | null = null;
export function setToastFn(fn: (msg: string) => void): void { toastFn = fn; }
export function showLimitError(err: LimitError): void {
  console.warn('[limits]', err.message, err);
  if (toastFn) toastFn(err.message);
  else alert(err.message);
}
