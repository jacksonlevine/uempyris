import FirecrawlApp from '@mendable/firecrawl-js'

export type ProductPageScrape = {
  sourceUrl: string
  content: string
  source: 'firecrawl' | 'direct_fetch' | 'empty'
}

const MAX_SCRAPE_LENGTH = 160_000
const MIN_USEFUL_LENGTH = 50

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

export async function scrapeProductPage(
  sourceUrl: string,
): Promise<ProductPageScrape> {
  const firecrawl = await scrapeWithFirecrawl(sourceUrl)
  if (firecrawl) return firecrawl

  const direct = await scrapeWithDirectFetch(sourceUrl)
  if (direct) return direct

  return {
    sourceUrl,
    content: '',
    source: 'empty',
  }
}

async function scrapeWithFirecrawl(
  sourceUrl: string,
): Promise<ProductPageScrape | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) return null

  try {
    const app = new FirecrawlApp({ apiKey })
    const doc = (await (app as unknown as {
      scrape: (url: string, params: unknown) => Promise<unknown>
    }).scrape(sourceUrl, {
      formats: ['markdown'],
      timeout: 30_000,
      maxAge: 600_000,
    })) as { markdown?: string | null }

    const content = (doc.markdown ?? '').trim()
    if (content.length < MIN_USEFUL_LENGTH) return null

    return {
      sourceUrl,
      content: content.slice(0, MAX_SCRAPE_LENGTH),
      source: 'firecrawl',
    }
  } catch {
    return null
  }
}

async function scrapeWithDirectFetch(
  sourceUrl: string,
): Promise<ProductPageScrape | null> {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'user-agent': BROWSER_USER_AGENT,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) return null

    const content = (await response.text()).trim()
    if (content.length < MIN_USEFUL_LENGTH) return null

    return {
      sourceUrl,
      content: content.slice(0, MAX_SCRAPE_LENGTH),
      source: 'direct_fetch',
    }
  } catch {
    return null
  }
}
