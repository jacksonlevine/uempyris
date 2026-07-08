import type { ProductPageScrape } from '#/ingestion/product-page-scrape.ts'

type ExtractProductImageUrlsInput = {
  sourceUrl: string
  productLabel?: string
  scrape: ProductPageScrape
}

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const REFERER_BY_HOST: Array<{ match: RegExp; referer: string }> = [
  { match: /(^|\.)scene7\.com$/i, referer: 'https://www.target.com/' },
  { match: /(^|\.)target\.com$/i, referer: 'https://www.target.com/' },
  { match: /media-amazon\.com$/i, referer: 'https://www.amazon.com/' },
  { match: /images-(na|eu)\.ssl-images-amazon\.com$/i, referer: 'https://www.amazon.com/' },
  { match: /amazon\.com$/i, referer: 'https://www.amazon.com/' },
  { match: /walmartimages\.com$/i, referer: 'https://www.walmart.com/' },
  { match: /walmart\.com$/i, referer: 'https://www.walmart.com/' },
  { match: /shopify(?:cdn)?\.com$/i, referer: 'https://www.shopify.com/' },
  { match: /bestbuyimg\.com$/i, referer: 'https://www.bestbuy.com/' },
  { match: /costco\.com$/i, referer: 'https://www.costco.com/' },
]

export async function extractProductImageUrls(
  input: ExtractProductImageUrlsInput,
) {
  if (!input.sourceUrl || !input.scrape.content.trim()) return []

  const markdownImages = extractMarkdownImageCandidates(
    input.scrape.content,
    input.sourceUrl,
  )
  const metadataImages = extractMetadataImageCandidates(
    input.scrape.content,
    input.sourceUrl,
  )
  const openRouterImages = await extractProductImagesWithOpenRouter(input)
  const candidates = dedupeUrls([
    ...openRouterImages,
    ...markdownImages,
    ...metadataImages,
  ]).slice(0, 60)

  const valid = await validateProductImageUrls(candidates)
  return valid.slice(0, 8)
}

async function extractProductImagesWithOpenRouter(
  input: ExtractProductImageUrlsInput,
) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || !input.scrape.content.trim()) return []

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'http-referer': process.env.APP_URL ?? 'http://localhost:3000',
      'x-title': 'Empyris Product Image Intake',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4.1-mini',
      temperature: 0,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'Structured data extraction from an e-commerce product page.',
            'You are given scraped product page evidence. Use only that evidence.',
            'Extract image URLs only for the specific product on the supplied URL.',
            'Include alternate views of that product: front, back, side, in-use, packaging, detail, label, ingredient panel.',
            'Order images so the primary product hero image is first.',
            'Only include image URLs that literally appear in the supplied page text. Do not invent or infer URLs.',
            'Exclude site logos, retailer logos, brand banners, navigation icons, payment badges, trust badges, review avatars, related-product images, recommendation/cross-sell images, sponsored items, category tiles, and other variants.',
            'If this is a marketplace page, do not return the marketplace logo. Return the product gallery image URLs only.',
            'Return strict JSON only with shape: {"images":["https://..."]}.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            sourceUrl: input.sourceUrl,
            productLabel: input.productLabel,
            scrapeSource: input.scrape.source,
            scrapedProductPageText: input.scrape.content,
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter product image extraction failed: ${response.status}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) return []

  const parsed = parseJsonObject(content) as { images?: unknown }
  if (!Array.isArray(parsed.images)) return []

  return parsed.images.filter((value): value is string => {
    if (typeof value !== 'string') return false
    try {
      const url = new URL(value)
      return url.protocol === 'https:' || url.protocol === 'http:'
    } catch {
      return false
    }
  })
}

function extractMarkdownImageCandidates(pageText: string, sourceUrl: string) {
  const candidates: string[] = []
  for (const match of pageText.matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (match[1]) candidates.push(match[1])
  }
  for (const match of pageText.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    if (match[1]) candidates.push(match[1])
  }
  for (const match of pageText.matchAll(/https?:\/\/[^\s"'<>)]*\.(?:avif|webp|png|jpe?g|gif)(?:\?[^\s"'<>)]*)?/gi)) {
    if (match[0]) candidates.push(match[0])
  }

  return candidates
    .map((candidate) => normalizeImageUrl(candidate, sourceUrl))
    .filter((candidate): candidate is string => candidate != null)
}

function extractMetadataImageCandidates(pageText: string, sourceUrl: string) {
  const candidates: string[] = []
  const metaPatterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image|twitter:image:src)["'][^>]*>/gi,
  ]

  for (const pattern of metaPatterns) {
    for (const match of pageText.matchAll(pattern)) {
      if (match[1]) candidates.push(match[1])
    }
  }

  const jsonImagePatterns = [
    /"image"\s*:\s*"([^"]+)"/gi,
    /"image"\s*:\s*\[\s*"([^"]+)"/gi,
    /"hiRes"\s*:\s*"([^"]+)"/gi,
    /"large"\s*:\s*"([^"]+)"/gi,
  ]

  for (const pattern of jsonImagePatterns) {
    for (const match of pageText.matchAll(pattern)) {
      if (match[1]) candidates.push(match[1])
    }
  }

  return candidates
    .map((candidate) => normalizeImageUrl(candidate, sourceUrl))
    .filter((candidate): candidate is string => candidate != null)
}

function normalizeImageUrl(candidate: string, sourceUrl: string) {
  const decoded = decodeHtmlEntities(candidate.trim())
  if (!decoded || decoded.startsWith('data:') || decoded.startsWith('blob:')) {
    return null
  }

  try {
    const url = new URL(decoded, sourceUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (/\.svg(?:$|[?#])/i.test(url.pathname)) return null
    return url.toString()
  } catch {
    return null
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/\\u002F/g, '/')
    .replace(/\\\//g, '/')
}

async function validateProductImageUrls(urls: string[]) {
  const valid: string[] = []

  for (const url of urls) {
    const displayUrl = await resolveDisplayImageUrl(url)
    if (displayUrl) valid.push(displayUrl)
  }

  return dedupeUrls(valid)
}

async function resolveDisplayImageUrl(url: string) {
  if (await fetchUsableImage(url, buildImageHeaders(url))) return url

  const proxyUrl = proxyImageUrl(url)
  if (
    proxyUrl &&
    (await fetchUsableImage(proxyUrl, {
      accept: 'image/*,*/*;q=0.8',
      'user-agent': BROWSER_USER_AGENT,
    }))
  ) {
    return proxyUrl
  }

  return null
}

function buildImageHeaders(url: string) {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    /* leave host empty */
  }

  const matchedReferer = REFERER_BY_HOST.find((entry) => entry.match.test(host))?.referer
  const referer = matchedReferer ?? (host ? `https://${host}/` : '')

  return {
    accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    'sec-ch-ua': '"Chromium";v="124", "Not-A.Brand";v="99", "Google Chrome";v="124"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'image',
    'sec-fetch-mode': 'no-cors',
    'sec-fetch-site': 'cross-site',
    'user-agent': BROWSER_USER_AGENT,
    ...(referer ? { referer } : {}),
  }
}

function proxyImageUrl(originalUrl: string) {
  if (!/^https?:\/\//i.test(originalUrl)) return null
  const stripped = originalUrl.replace(/^https?:\/\//i, '')
  return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}`
}

async function fetchUsableImage(url: string, headers: Record<string, string>) {
  try {
    const response = await fetch(url, {
      headers,
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) return false
    const buffer = new Uint8Array(await response.arrayBuffer())
    return isUsableImageResponse(response, url, buffer)
  } catch {
    return false
  }
}

function isUsableImageResponse(response: Response, url: string, buffer: Uint8Array) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (isSniffedRasterImage(buffer)) return true
  if (contentType.startsWith('image/') && contentType !== 'image/svg+xml') return true
  return /\.(?:avif|webp|png|jpe?g|gif)(?:$|[?#])/i.test(new URL(url).pathname)
}

function isSniffedRasterImage(buffer: Uint8Array) {
  if (buffer.length < 4) return false
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return true
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return true
  }
  return false
}

function parseJsonObject(value: string) {
  const trimmed = value.trim()
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed)
  const candidate = fenced?.[1]?.trim() ?? trimmed

  try {
    return JSON.parse(candidate)
  } catch {
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1))
    }
    throw new Error(`OpenRouter product image extraction returned non-JSON content: ${trimmed.slice(0, 120)}`)
  }
}

function dedupeUrls(urls: string[]) {
  return [...new Set(urls.map((url) => url.trim()).filter(Boolean))]
}
