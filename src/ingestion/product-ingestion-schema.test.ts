import { describe, expect, it } from 'vitest'

import {
  buildProductIngestionOutput,
  productFactsFromOutput,
  productIngestionInputSchema,
} from '#/ingestion/product-ingestion-schema.ts'

const productId = '018f7bc2-8703-7b8f-8f91-7d37edc5f0bd'

describe('product ingestion schemas', () => {
  it('validates the trigger payload schema', () => {
    expect(
      productIngestionInputSchema.parse({
        organizationId: 'org_123',
        productId,
      }),
    ).toEqual({
      organizationId: 'org_123',
      productId,
    })
  })

  it('maps submitted product fields directly into output facts', () => {
    const output = buildProductIngestionOutput({
      productId,
      organizationId: 'org_123',
      label: 'Test Product',
      sourceUrl: 'https://example.com/product',
      claims: 'Hydrates dry skin.',
      evidence: 'Dermatologist reviewed.',
      brandVoice: 'Clinical and direct.',
    })

    expect(output.input).toEqual({
      label: 'Test Product',
      sourceUrl: 'https://example.com/product',
      claims: 'Hydrates dry skin.',
      evidence: 'Dermatologist reviewed.',
      brandVoice: 'Clinical and direct.',
    })
    expect(productFactsFromOutput(output)).toEqual([
      {
        category: 'label',
        statement: 'Test Product',
        source: 'form_label',
        sourceExcerpt: 'Test Product',
        confidence: 1,
      },
      {
        category: 'source_url',
        statement: 'https://example.com/product',
        source: 'url',
        sourceExcerpt: 'https://example.com/product',
        confidence: 1,
      },
      {
        category: 'claims',
        statement: 'Hydrates dry skin.',
        source: 'form_claims',
        sourceExcerpt: 'Hydrates dry skin.',
        confidence: 1,
      },
      {
        category: 'evidence',
        statement: 'Dermatologist reviewed.',
        source: 'form_evidence',
        sourceExcerpt: 'Dermatologist reviewed.',
        confidence: 1,
      },
      {
        category: 'brand_voice',
        statement: 'Clinical and direct.',
        source: 'form_brand_voice',
        sourceExcerpt: 'Clinical and direct.',
        confidence: 1,
      },
    ])
  })
})
