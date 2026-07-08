import {
  ensureComplianceCorpusSeeded,
  loadSeedApprovedClaims,
} from '#/compliance/corpus.ts'
import {
  approvedClaimId,
  listApprovedComplianceSourceDocuments,
} from '#/data/compliance.ts'
import { productIngestionOutputSchema } from '#/ingestion/product-ingestion-schema.ts'

import type {
  ProductIngestionWorkflow,
  ProductIngestionWorkflowInput,
} from './types.ts'
import type {
  ProductIngestionApprovedClaim,
  ProductIngestionCitation,
  ProductIngestionComplianceCheck,
  ProductIngestionOutput,
} from '#/ingestion/product-ingestion-schema.ts'

export const complianceApprovedClaimsWorkflow: ProductIngestionWorkflow = {
  id: 'compliance-approved-claims',
  run: async (input) => {
    await ensureComplianceCorpusSeeded()
    const documents = await listApprovedComplianceSourceDocuments()
    const sourceDocumentsUsed = sourceRefs(documents)
    const approvedClaims = await generateApprovedClaims(input, sourceDocumentsUsed)
    const complianceChecks = buildComplianceChecks(input.claims, sourceDocumentsUsed)
    const facts = [
      ...baseFacts(input),
      ...approvedClaims.map((claim) => ({
        category: 'approved_claim',
        statement: claim.claimText,
        source: 'compliance_workflow',
        sourceExcerpt: claim.rationale,
        confidence: 0.75,
      })),
    ]

    const output = {
      productId: input.productId,
      organizationId: input.organizationId,
      workflowId: complianceApprovedClaimsWorkflow.id,
      input: {
        label: input.label,
        sourceUrl: input.sourceUrl,
        claims: input.claims,
        evidence: input.evidence,
        brandVoice: input.brandVoice,
      },
      facts,
      approvedClaims,
      complianceChecks,
      sourceDocumentsUsed,
    }

    return productIngestionOutputSchema.parse(output)
  },
}

async function generateApprovedClaims(
  input: ProductIngestionWorkflowInput,
  sourceDocumentsUsed: ProductIngestionCitation[],
) {
  const openRouterClaims = await generateClaimsWithOpenRouter(input, sourceDocumentsUsed)
  if (openRouterClaims) return openRouterClaims

  const seedClaims = await seedClaimsForProduct(input, sourceDocumentsUsed)
  if (seedClaims.length > 0) return seedClaims

  return fallbackClaims(input, sourceDocumentsUsed)
}

async function generateClaimsWithOpenRouter(
  input: ProductIngestionWorkflowInput,
  sourceDocumentsUsed: ProductIngestionCitation[],
) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) return null

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'http-referer': process.env.APP_URL ?? 'http://localhost:3000',
      'x-title': 'Empyris Approved Claims Intake',
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
            'You propose conservative approved advertising claims for a U.S. dietary supplement product.',
            'Only propose claims that avoid disease treatment, cure, mitigation, diagnosis, or prevention.',
            'Each proposed claim must be a structure/function or general wellness style claim and must cite supplied source ids.',
            'Do not invent law. Use the supplied regulatory source refs only.',
            'Return strict JSON only.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            task: 'Generate proposed brand-approved claims for human approval.',
            productInfo: productInfoForPrompt(input),
            regulatorySources: sourceDocumentsUsed,
            requiredOutput: {
              claims: [
                {
                  claimText: 'exact proposed claim copy',
                  claimType: 'structure_function|general_wellness|nutrient_or_ingredient',
                  rationale: 'why this is plausibly acceptable if substantiated',
                  requiredDisclosures: ['required qualifier/disclosure'],
                  forbiddenImplications: ['nearby meaning the claim must not imply'],
                  markets: ['US'],
                  channels: ['Meta|Amazon|Website'],
                  citations: ['documentId values from regulatorySources'],
                },
              ],
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

  const parsed = JSON.parse(content) as {
    claims?: Array<{
      claimText?: string
      claimType?: string
      rationale?: string
      requiredDisclosures?: string[]
      forbiddenImplications?: string[]
      markets?: string[]
      channels?: string[]
      citations?: string[]
    }>
  }
  const sourceById = new Map(sourceDocumentsUsed.map((source) => [source.documentId, source]))

  return (parsed.claims ?? [])
    .filter((claim) => claim.claimText?.trim())
    .slice(0, 12)
    .map((claim, index) =>
      normalizeGeneratedClaim({
        input,
        claimText: claim.claimText ?? '',
        claimType: claim.claimType,
        rationale: claim.rationale,
        requiredDisclosures: claim.requiredDisclosures,
        forbiddenImplications: claim.forbiddenImplications,
        markets: claim.markets,
        channels: claim.channels,
        citations: (claim.citations ?? [])
          .map((id) => sourceById.get(id))
          .filter((source): source is ProductIngestionCitation => Boolean(source)),
        generatedBy: 'openrouter',
        salt: `openrouter-${index}`,
      }),
    )
}

async function seedClaimsForProduct(
  input: ProductIngestionWorkflowInput,
  sourceDocumentsUsed: ProductIngestionCitation[],
) {
  const seeds = await loadSeedApprovedClaims()
  const labelTokens = tokenSet(input.label)
  const matching = seeds.filter((claim) => {
    const haystack = `${claim.product ?? ''} ${claim.claimText}`.toLowerCase()
    return [...labelTokens].some((token) => token.length > 3 && haystack.includes(token))
  })

  return matching.slice(0, 6).map((claim, index) =>
    normalizeGeneratedClaim({
      input,
      claimText: claim.claimText,
      claimType: claim.claimType,
      rationale: claim.rationale,
      requiredDisclosures: claim.requiredDisclosures,
      forbiddenImplications: claim.forbiddenImplications,
      markets: claim.markets,
      channels: claim.channels,
      citations: claim.citations?.length ? claim.citations : sourceDocumentsUsed.slice(0, 3),
      generatedBy: 'seed_corpus',
      salt: `seed-${claim.id}-${index}`,
    }),
  )
}

function fallbackClaims(
  input: ProductIngestionWorkflowInput,
  sourceDocumentsUsed: ProductIngestionCitation[],
) {
  return [
    'Supports normal daily wellness.',
    'Helps support healthy routine adherence.',
    'Supports normal function as part of a balanced lifestyle.',
  ].map((claimText, index) =>
    normalizeGeneratedClaim({
      input,
      claimText,
      claimType: 'structure_function',
      rationale:
        'Conservative structure/function-style claim. Requires brand substantiation and DSHEA disclaimer review before use.',
      requiredDisclosures: ['DSHEA disclaimer where applicable'],
      forbiddenImplications: ['diagnose', 'treat', 'cure', 'prevent disease'],
      markets: ['US'],
      channels: ['Website', 'Meta', 'Amazon'],
      citations: sourceDocumentsUsed.slice(0, 3),
      generatedBy: 'fallback',
      salt: `fallback-${index}`,
    }),
  )
}

function normalizeGeneratedClaim(input: {
  input: ProductIngestionWorkflowInput
  claimText: string
  claimType?: string
  rationale?: string
  requiredDisclosures?: string[]
  forbiddenImplications?: string[]
  markets?: string[]
  channels?: string[]
  citations?: ProductIngestionCitation[]
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
    claimType: input.claimType || 'structure_function',
    status: 'proposed',
    rationale: input.rationale || '',
    requiredDisclosures: input.requiredDisclosures ?? [],
    forbiddenImplications: input.forbiddenImplications ?? [],
    markets: input.markets ?? ['US'],
    channels: input.channels ?? ['Website'],
    citations: input.citations ?? [],
    generatedBy: input.generatedBy,
  }
}

function buildComplianceChecks(
  claims: string | null,
  sourceDocumentsUsed: ProductIngestionCitation[],
): ProductIngestionComplianceCheck[] {
  return splitClaims(claims).map((inputClaim) => {
    const diseaseRelated = diseaseClaimPattern.test(inputClaim)
    return {
      inputClaim,
      decision: diseaseRelated ? 'fail' : 'needs_human_review',
      rationale: diseaseRelated
        ? 'Claim appears to imply disease treatment, cure, mitigation, diagnosis, or prevention and should not be used as a dietary supplement claim without legal review.'
        : 'Claim does not match the local disease-claim screen, but still needs substantiation and human approval before use.',
      citedDocumentIds: sourceDocumentsUsed
        .map((source) => source.documentId)
        .filter((id): id is string => Boolean(id))
        .slice(0, 3),
    }
  })
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

function sourceRefs(
  documents: Array<{
    id: string
    title: string
    authority: string | null
    sourceType: string
    url: string
    contentMarkdown: string
  }>,
): ProductIngestionCitation[] {
  return documents
    .filter((document) =>
      /101\.93|structure\/function|structure-function|Health Products Compliance Guidance|substantiation|deception/i.test(
        `${document.title} ${document.contentMarkdown}`,
      ),
    )
    .slice(0, 8)
    .map((document) => ({
      documentId: document.id,
      title: document.title,
      authority: document.authority ?? undefined,
      sourceType: document.sourceType,
      url: document.url,
    }))
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

function splitClaims(value: string | null) {
  return (value ?? '')
    .split(/\n+|(?:^|\s)[-*]\s+/)
    .map((claim) => claim.trim())
    .filter(Boolean)
}

function tokenSet(value: string) {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))
}

const diseaseClaimPattern =
  /\b(treat|treats|treated|cure|cures|cured|prevent|prevents|diagnose|diagnoses|mitigate|mitigates|heal|heals|cancer|diabetes|arthritis|depression|anxiety|infection|inflammation|autoimmune|pcos|obesity|disease)\b/i
