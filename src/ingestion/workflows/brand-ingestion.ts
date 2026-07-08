import {
  brandIngestionOutputSchema,
  type BrandDnaSnapshot,
  type BrandIngestionInput,
  type BrandIngestionOutput,
} from '#/ingestion/brand-ingestion-schema.ts'
import {
  scrapeProductPage,
  type ProductPageScrape,
} from '#/ingestion/product-page-scrape.ts'

const WORKFLOW_ID = 'brand-ingestion'

export async function runBrandIngestionWorkflow(
  input: BrandIngestionInput,
): Promise<BrandIngestionOutput> {
  const productOrigin = originOf(input.productUrl)
  const scrape = await scrapeProductPage(input.productUrl)
  const snapshot =
    (await generateBrandDnaWithOpenRouter(input, productOrigin, scrape)) ??
    fallbackBrandDna(input, productOrigin)

  return brandIngestionOutputSchema.parse({
    productId: input.productId,
    organizationId: input.organizationId,
    brandId: input.brandId,
    workflowId: WORKFLOW_ID,
    cached: false,
    snapshot,
  })
}

async function generateBrandDnaWithOpenRouter(
  input: BrandIngestionInput,
  productOrigin: string,
  scrape: ProductPageScrape,
): Promise<BrandDnaSnapshot | null> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const model =
    process.env.OPENROUTER_BRAND_MODEL ??
    process.env.OPENROUTER_MODEL ??
    'anthropic/claude-sonnet-4'

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'http-referer': process.env.APP_URL ?? 'http://localhost:3000',
      'x-title': 'Empyris Brand Ingestion',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 4500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You are the Empyris brand research workflow.',
            'You are given scraped product page evidence. Use it as the ground truth for identifying the consumer brand/manufacturer for the supplied product.',
            'The product URL may be a marketplace or retailer page. Amazon, Walmart, Target, iHerb, GNC, Etsy, eBay, Shopify storefront hosts, and similar retailers are not the brand unless the product itself is actually their private-label brand.',
            'Use the product label and scraped product page evidence to identify the real product brand. Do not use the retailer domain as brandName.',
            'Do not browse. Do not infer brand identity from the retailer host. If the scraped evidence is ambiguous, return the best human-reviewable brand guess from the product title or page text.',
            'You must call the equivalent of submit_brand_dna by returning strict JSON only.',
            'Return exactly these fields: brandName, brandDnaMarkdown, imagePromptModifier, citations.',
            'brandDnaMarkdown is the full BRAND DNA DOCUMENT in markdown.',
            'imagePromptModifier is a single 50-75 word paragraph to prepend to downstream image prompts, including exact colors, typography direction, photography direction, and mood when discoverable.',
            'Do not return compliance analysis or product claims.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Generate brand DNA from a product link.',
            productLabel: input.productLabel,
            productUrl: input.productUrl,
            productOrigin,
            retailerHost: hostOf(input.productUrl),
            productPageEvidence: {
              sourceUrl: scrape.sourceUrl,
              scrapeSource: scrape.source,
              scrapedProductPageText: scrape.content.slice(0, 60_000),
            },
            requiredOutput: {
              brandName: 'official brand name',
              brandDnaMarkdown: 'markdown brand voice and brand identity document',
              imagePromptModifier: '50-75 word image prompt style modifier',
              citations: [{ url: 'source URL', title: 'optional title' }],
            },
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter brand ingestion failed: ${response.status}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string; annotations?: unknown[] } }>
    model?: string
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) return null

  const parsed = parseModelJson(content) as {
    brandName?: string
    brandDnaMarkdown?: string
    imagePromptModifier?: string
    citations?: Array<{ url?: string; title?: string }>
  }

  if (!parsed.brandDnaMarkdown || !parsed.imagePromptModifier) return null

  return {
    brandName: sanitizeBrandName(parsed.brandName, input, productOrigin),
    productUrl: productOrigin,
    brandDnaMarkdown: parsed.brandDnaMarkdown.trim(),
    imagePromptModifier: parsed.imagePromptModifier.trim(),
    citations: (parsed.citations ?? [])
      .filter((citation): citation is { url: string; title?: string } =>
        Boolean(citation.url),
      )
      .map((citation) =>
        citation.title
          ? { url: citation.url, title: citation.title }
          : { url: citation.url },
      ),
    model: payload.model ?? model,
  }
}

function fallbackBrandDna(
  input: BrandIngestionInput,
  productOrigin: string,
): BrandDnaSnapshot {
  const brandName = brandNameFromProductLabel(input.productLabel) ?? brandNameFromUrl(productOrigin)
  return {
    brandName,
    productUrl: productOrigin,
    brandDnaMarkdown: [
      `# ${brandName} Brand DNA`,
      '',
      `Source product: ${input.productLabel}`,
      `Product origin: ${productOrigin}`,
      '',
      '## Voice',
      'Direct, product-led, and evidence-aware. Replace this fallback with the OpenRouter-generated brand DNA when OPENROUTER_API_KEY is configured.',
      '',
      '## Visual Direction',
      'Clean product photography, clear hierarchy, restrained color use, and practical consumer-facing composition.',
    ].join('\n'),
    imagePromptModifier:
      'Clean product-led commercial photography with crisp lighting, restrained color, clear typography hierarchy, and a practical premium wellness tone. Favor sharp packaging details, natural shadows, and uncluttered compositions that keep the product immediately inspectable.',
    citations: [{ url: input.productUrl }],
    model: 'fallback',
  }
}

function originOf(productUrl: string) {
  const url = new URL(productUrl)
  return `${url.protocol}//${url.host}`
}

function hostOf(productUrl: string) {
  return new URL(productUrl).hostname.replace(/^www\./, '')
}

function parseModelJson(content: string) {
  const trimmed = content.trim()
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
    throw new Error(`OpenRouter brand ingestion returned non-JSON content: ${trimmed.slice(0, 120)}`)
  }
}

function sanitizeBrandName(
  value: string | undefined,
  input: BrandIngestionInput,
  productOrigin: string,
) {
  const brandName = value?.trim()
  if (brandName && !isRetailerBrandName(brandName, input.productUrl)) return brandName
  return brandNameFromProductLabel(input.productLabel) ?? brandNameFromUrl(productOrigin)
}

function isRetailerBrandName(brandName: string, productUrl: string) {
  const normalized = brandName.toLowerCase().replace(/[^a-z0-9]/g, '')
  const host = hostOf(productUrl).toLowerCase()
  return marketplaceBrandNames.includes(normalized) || marketplaceHosts.some(
    (marketplace) =>
      host === marketplace ||
      host.endsWith(`.${marketplace}`) ||
      normalized === marketplace.replace(/[^a-z0-9]/g, ''),
  )
}

function brandNameFromProductLabel(label: string) {
  const cleaned = label
    .trim()
    .replace(/^amazon(?:\.com)?\s*[:|-]\s*/i, '')
    .replace(/^walmart(?:\.com)?\s*[:|-]\s*/i, '')
    .replace(/^target(?:\.com)?\s*[:|-]\s*/i, '')
  if (!cleaned) return null
  const separators = [' - ', ' | ', ' by ']
  for (const separator of separators) {
    const [first] = cleaned.split(separator)
    if (first?.trim()) return titleCase(first.trim())
  }
  const words = cleaned.split(/\s+/).filter(Boolean)
  return words.length > 0 ? titleCase(words.slice(0, Math.min(words.length, 2)).join(' ')) : null
}

function brandNameFromUrl(value: string) {
  const host = new URL(value).hostname.replace(/^www\./, '')
  const [name] = host.split('.')
  return name ? titleCase(name.replace(/[-_]+/g, ' ')) : host
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

const marketplaceHosts = [
  'amazon.com',
  'walmart.com',
  'target.com',
  'ebay.com',
  'etsy.com',
  'iherb.com',
  'gnc.com',
  'vitacost.com',
  'instacart.com',
]

const marketplaceBrandNames = [
  'amazon',
  'walmart',
  'target',
  'ebay',
  'etsy',
  'iherb',
  'gnc',
  'vitacost',
  'instacart',
]
