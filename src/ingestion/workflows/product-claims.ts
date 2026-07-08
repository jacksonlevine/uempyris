import { approvedClaimId } from '#/data/product-claims.ts'
import { extractProductImageUrls } from '#/ingestion/product-images.ts'
import { productIngestionOutputSchema } from '#/ingestion/product-ingestion-schema.ts'
import {
  scrapeProductPage,
  type ProductPageScrape,
} from '#/ingestion/product-page-scrape.ts'

import type {
  ProductIngestionWorkflow,
  ProductIngestionWorkflowInput,
} from './types.ts'
import type {
  ProductIngestionApprovedClaim,
  ProductIngestionOutput,
} from '#/ingestion/product-ingestion-schema.ts'

export const productClaimsWorkflow: ProductIngestionWorkflow = {
  id: 'product-claims',
  run: async (input) => {
    const scrape = await scrapeProductPage(input.sourceUrl)
    const productImages = await extractProductImageUrls({
      sourceUrl: input.sourceUrl,
      productLabel: input.label,
      scrape,
    })
    const approvedClaims = await generateApprovedClaims(input, scrape)
    const facts = [
      ...baseFacts(input),
      ...productImages.map((imageUrl, index) => ({
        category: 'product_image',
        statement: imageUrl,
        source: 'url',
        sourceExcerpt: imageUrl,
        confidence: index === 0 ? 0.85 : 0.75,
      })),
      ...approvedClaims.map((claim) => ({
        category: 'approved_claim',
        statement: claim.claimText,
        source: 'product_claims_workflow',
        sourceExcerpt: claim.claimText,
        confidence: 0.75,
      })),
    ]

    const output = {
      productId: input.productId,
      organizationId: input.organizationId,
      workflowId: productClaimsWorkflow.id,
      input: {
        label: input.label,
        sourceUrl: input.sourceUrl,
        claims: input.claims,
        evidence: input.evidence,
        brandVoice: input.brandVoice,
      },
      facts,
      approvedClaims,
      productImages,
    }

    return productIngestionOutputSchema.parse(output)
  },
}

async function generateApprovedClaims(
  input: ProductIngestionWorkflowInput,
  scrape: ProductPageScrape,
) {
  const openRouterClaims = await generateClaimsWithOpenRouter(input, scrape)
  if (openRouterClaims) return openRouterClaims

  return fallbackClaims(input)
}

async function generateClaimsWithOpenRouter(
  input: ProductIngestionWorkflowInput,
  scrape: ProductPageScrape,
) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'http-referer': process.env.APP_URL ?? 'http://localhost:3000',
      'x-title': 'Empyris Product Claims Intake',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4.1-mini',
      temperature: 0,
      max_tokens: 3500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            'You propose product marketing claims for human brand approval.',
            'You are given scraped product page evidence. Use it as ground truth for the product identity, ingredients, and product context.',
            'A claim is one sentence. Return only claim sentences, no supporting metadata.',
            'Do not return analysis, citations, explanations, labels, categories, or channel guidance.',
            'Do not browse. Do not infer product facts from the retailer host. If the evidence is thin, keep claims factual and human-reviewable.',
            'Return strict JSON only.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Generate proposed brand-approved claims for human approval.',
            productInfo: productInfoForPrompt(input),
            productPageEvidence: {
              sourceUrl: scrape.sourceUrl,
              scrapeSource: scrape.source,
              scrapedProductPageText: scrape.content.slice(0, 60_000),
            },
            requiredOutput: {
              claims: ['one sentence claim'],
            },
          }),
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`OpenRouter approved claim generation failed: ${response.status}`)
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) return null

  const parsed = parseModelJson(content) as {
    claims?: Array<string | { claimText?: string }>
  }

  return (parsed.claims ?? [])
    .map((claim) => (typeof claim === 'string' ? claim : claim.claimText ?? ''))
    .filter((claimText) => claimText.trim())
    .slice(0, 12)
    .map((claimText, index) =>
      normalizeGeneratedClaim({
        input,
        claimText,
        generatedBy: 'openrouter',
        salt: `openrouter-${index}`,
      }),
    )
}

function fallbackClaims(input: ProductIngestionWorkflowInput) {
  return [
    `${input.label} is designed for everyday product use.`,
    `${input.label} fits into a simple daily routine.`,
    `${input.label} offers a product-led option for customers comparing similar products.`,
  ].map((claimText, index) =>
    normalizeGeneratedClaim({
      input,
      claimText,
      generatedBy: 'fallback',
      salt: `fallback-${index}`,
    }),
  )
}

function normalizeGeneratedClaim(input: {
  input: ProductIngestionWorkflowInput
  claimText: string
  generatedBy: string
  salt: string
}): ProductIngestionApprovedClaim {
  return {
    id: approvedClaimId({
      productId: input.input.productId,
      claimText: input.claimText,
      salt: input.salt,
    }),
    claimText: input.claimText.trim(),
    status: 'proposed',
    generatedBy: input.generatedBy,
  }
}

function baseFacts(input: ProductIngestionWorkflowInput): ProductIngestionOutput['facts'] {
  return [
    {
      category: 'label',
      statement: input.label,
      source: 'form_label',
      sourceExcerpt: input.label,
      confidence: 1,
    },
    {
      category: 'source_url',
      statement: input.sourceUrl,
      source: 'url',
      sourceExcerpt: input.sourceUrl,
      confidence: 1,
    },
    ...optionalFact('claims', input.claims, 'form_claims'),
    ...optionalFact('evidence', input.evidence, 'form_evidence'),
    ...optionalFact('brand_voice', input.brandVoice, 'form_brand_voice'),
  ]
}

function optionalFact(
  category: 'claims' | 'evidence' | 'brand_voice',
  value: string | null,
  source: 'form_claims' | 'form_evidence' | 'form_brand_voice',
): ProductIngestionOutput['facts'] {
  const trimmed = value?.trim()
  if (!trimmed) return []
  return [
    {
      category,
      statement: trimmed,
      source,
      sourceExcerpt: trimmed,
      confidence: 1,
    },
  ]
}

function productInfoForPrompt(input: ProductIngestionWorkflowInput) {
  return [
    `Product label: ${input.label}`,
    `Product URL: ${input.sourceUrl}`,
    input.claims ? `Submitted claims: ${input.claims}` : null,
    input.evidence ? `Evidence/substantiation: ${input.evidence}` : null,
    input.brandVoice ? `Brand voice/style: ${input.brandVoice}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
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
    throw new Error(`OpenRouter approved claim generation returned non-JSON content: ${trimmed.slice(0, 120)}`)
  }
}
