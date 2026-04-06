import { NextRequest, NextResponse } from 'next/server'

/** 직접 fetch가 막히거나 og 태그가 없을 때 Microlink(무료 티어)로 보강. API 키 없이도 동작(속도·쿼터 제한 있음). */
async function fetchMicrolinkMeta(targetUrl: string): Promise<{
  image: string | null
  title: string | null
  description: string | null
}> {
  const key = process.env.MICROLINK_API_KEY?.trim()
  const q = new URLSearchParams({ url: targetUrl })
  if (key) q.set('apiKey', key)
  try {
    const res = await fetch(`https://api.microlink.io/?${q.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { image: null, title: null, description: null }
    const body = (await res.json()) as {
      data?: {
        title?: string
        description?: string
        image?: { url?: string }
        logo?: { url?: string }
      }
    }
    const d = body.data
    if (!d) return { image: null, title: null, description: null }
    const img = d.image?.url ?? d.logo?.url ?? null
    return {
      image: img,
      title: d.title ?? null,
      description: d.description ?? null,
    }
  } catch {
    return { image: null, title: null, description: null }
  }
}

const KO_STOPWORDS = new Set(['의','가','이','은','들','는','좀','잘','걍','과','도','를','으로','자','에','와','한','하다','및','등','에서','으로서','에게','께','로','부터','까지','만','도','라도','이라도','이나','나','거나','든지','든가','거든','거든지'])
const EN_STOPWORDS = new Set(['a','an','the','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','need','dare','ought','used','to','of','in','for','on','with','at','by','from','up','about','into','through','during','before','after','above','below','between','out','off','over','under','again','further','then','once','and','but','or','nor','so','yet','both','either','neither','not','only','own','same','than','too','very','s','t','just','now'])

function extractKeywords(title: string | null, description: string | null, metaKeywords: string | null): string[] {
  const tags: string[] = []

  // 1. meta keywords (comma-separated)
  if (metaKeywords) {
    const kws = metaKeywords.split(/[,|·]/).map((k) => k.trim()).filter((k) => k.length > 1 && k.length < 30)
    tags.push(...kws.slice(0, 8))
  }

  // 2. title words
  if (title) {
    const words = title
      .replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 1 && !EN_STOPWORDS.has(w) && !KO_STOPWORDS.has(w))
    tags.push(...words.slice(0, 5))
  }

  // 3. description keywords (first 3 nouns)
  if (description && !metaKeywords) {
    const words = description
      .replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 2 && !EN_STOPWORDS.has(w) && !KO_STOPWORDS.has(w))
    tags.push(...words.slice(0, 4))
  }

  // dedupe, normalize, limit
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 10)
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  try { new URL(url) } catch {
    return NextResponse.json({ image: null, title: null, description: null, keywords: [] })
  }

  let outImage: string | null = null
  let outTitle: string | null = null
  let outDescription: string | null = null
  let metaKeywords: string | null = null

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ProbyBot/1.0; +https://proby.io)',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(6000),
    })

    const reader = res.ok ? res.body?.getReader() : undefined
    if (reader) {
      let html = ''
      let bytes = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        html += new TextDecoder().decode(value)
        bytes += value?.length ?? 0
        if (bytes > 50_000) break
      }
      reader.cancel()

      const extract = (patterns: RegExp[]) => {
        for (const re of patterns) {
          const m = html.match(re)
          if (m?.[1]) return m[1].trim().replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        }
        return null
      }

      const image = extract([
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
        /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["']/i,
        /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']/i,
      ])

      outTitle = extract([
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
        /<title[^>]*>([^<]+)<\/title>/i,
      ])

      outDescription = extract([
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
      ])

      metaKeywords = extract([
        /<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']keywords["']/i,
      ])

      if (image) {
        if (image.startsWith('http')) outImage = image
        else {
          try { outImage = new URL(image, url).href } catch { outImage = null }
        }
      }
    }
  } catch {
    /* 직접 fetch 실패 시 Microlink만 시도 */
  }

  // 직접 HTML이 비었거나 썸네일/텍스트가 부족할 때 외부 메타 API로 보강 (봇 차단·CSR·og 미설정 등)
  if (!outImage || (!outTitle && !outDescription)) {
    const ml = await fetchMicrolinkMeta(url)
    if (!outImage && ml.image) outImage = ml.image
    if (!outTitle && ml.title) outTitle = ml.title
    if (!outDescription && ml.description) outDescription = ml.description
  }

  const keywords = extractKeywords(outTitle, outDescription, metaKeywords)
  return NextResponse.json({ image: outImage, title: outTitle, description: outDescription, keywords })
}
