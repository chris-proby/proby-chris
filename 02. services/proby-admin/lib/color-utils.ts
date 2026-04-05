export interface ColorPalette {
  primary: string
  secondary: string
  accent: string
  swatches: string[]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function colorDistance(c1: number[], c2: number[]): number {
  return Math.sqrt((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2)
}

function isNeutral(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  // HSL lightness = (max + min) / 2 / 255  — correctly identifies white/black
  // (using max/255 was wrong: pure orange R=255,G=85,B=0 → max/255=1.0, falsely filtered as white)
  const lightness = (max + min) / 2 / 255
  const saturation = max === 0 ? 0 : (max - min) / max
  return lightness > 0.93 || lightness < 0.04 || saturation < 0.12
}

export function extractColorsFromImage(imgEl: HTMLImageElement): ColorPalette {
  const canvas = document.createElement('canvas')
  const size = 80
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(imgEl, 0, 0, size, size)

  const { data } = ctx.getImageData(0, 0, size, size)
  const buckets: Map<string, { r: number; g: number; b: number; count: number }> = new Map()

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a < 128) continue
    if (isNeutral(r, g, b)) continue
    // quantize to 24-step buckets
    const qr = Math.round(r / 24) * 24
    const qg = Math.round(g / 24) * 24
    const qb = Math.round(b / 24) * 24
    const key = `${qr},${qg},${qb}`
    const existing = buckets.get(key)
    if (existing) { existing.count++; existing.r += r; existing.g += g; existing.b += b }
    else buckets.set(key, { r, g, b, count: 1 })
  }

  // Sort by count
  const sorted = Array.from(buckets.values())
    .sort((a, b) => b.count - a.count)
    .map((v) => ({ r: Math.round(v.r / v.count), g: Math.round(v.g / v.count), b: Math.round(v.b / v.count), count: v.count }))

  // Deduplicate (remove colors too similar to already selected)
  const selected: typeof sorted = []
  for (const color of sorted) {
    if (selected.length >= 5) break
    const tooClose = selected.some((s) => colorDistance([color.r, color.g, color.b], [s.r, s.g, s.b]) < 60)
    if (!tooClose) selected.push(color)
  }

  // Fill with fallbacks if not enough colors (neutral, not biased purple)
  while (selected.length < 3) selected.push({ r: 120, g: 120, b: 120, count: 0 })

  const swatches = selected.map((c) => rgbToHex(c.r, c.g, c.b))

  return {
    primary: swatches[0] ?? '#6366f1',
    secondary: swatches[1] ?? '#8b5cf6',
    accent: swatches[2] ?? '#06b6d4',
    swatches,
  }
}

// Darken/lighten a hex color
export function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
  return rgbToHex(r, g, b)
}

// Convert hex to rgba string
export function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r},${g},${b},${alpha})`
}
