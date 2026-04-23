import { useEffect } from 'react';
import { useStore } from '../store';

function isURL(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url.slice(0, 40); }
}

export function useClipboardPaste() {
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't intercept paste inside inputs / textareas / inspector fields
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('.inspector')
      ) return;

      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const { viewport, addWidget, updateWidgetData, setSelectedWidget } = useStore.getState();

      const vw = window.innerWidth;
      const vh = window.innerHeight - 52;
      const jitter = () => (Math.random() - 0.5) * 60;
      const cx = (vw / 2 - viewport.x) / viewport.scale;
      const cy = (vh / 2 - viewport.y) / viewport.scale;

      // ── Images (screenshots, copied images) ──
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (!blob) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const id = addWidget('image', cx - 140 + jitter(), cy - 110 + jitter());
            updateWidgetData(id, { src: reader.result as string, name: 'screenshot', caption: '' });
            setSelectedWidget(id);
          };
          reader.readAsDataURL(blob);
          e.preventDefault();
          return;
        }
      }

      // ── Text (URL → Link, otherwise → Note) ──
      for (const item of Array.from(items)) {
        if (item.type === 'text/plain') {
          item.getAsString((raw) => {
            const text = raw.trim();
            if (!text) return;

            if (isURL(text)) {
              const id = addWidget('link', cx - 140 + jitter(), cy - 55 + jitter());
              updateWidgetData(id, { url: text, title: extractDomain(text), description: '' });
              setSelectedWidget(id);
            } else {
              const id = addWidget('note', cx - 110 + jitter(), cy - 80 + jitter());
              updateWidgetData(id, { content: text });
              setSelectedWidget(id);
            }
          });
          e.preventDefault();
          return;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);
}
