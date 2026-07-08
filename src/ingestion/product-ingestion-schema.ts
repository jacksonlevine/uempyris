import * as z from 'zod'

import type { ProductFactInput } from '#/data/ingestion.ts'

export const productIngestionInputSchema = z.object({
  organizationId: z.string().min(1),
  productId: z.uuid(),
})

export const productIngestionFieldSchema = z.object({
  label: z.string(),
  sourceUrl: z.string(),
  claims: z.string().nullable(),
  evidence: z.string().nullable(),
  brandVoice: z.string().nullable(),
})

export const productIngestionFactSchema = z.object({
  category: z.enum([
    'label',
    'source_url',
    'claims',
    'evidence',
    'brand_voice',
    'approved_claim',
  ]),
  statement: z.string(),
  source: z.enum([
    'url',
    'form_label',
    'form_claims',
    'form_evidence',
    'form_brand_voice',
    'compliance_workflow',
  ]),
  sourceExcerpt: z.string().nullable(),
  confidence: z.number().min(0).max(1),
})

export const productIngestionCitationSchema = z.object({
  documentId: z.string().optional(),
  title: z.string().optional(),
  authority: z.string().optional(),
  sourceType: z.string().optional(),
  url: z.string().optional(),
})

export const productIngestionApprovedClaimSchema = z.object({
  id: z.string(),
  claimText: z.string(),
  claimType: z.string(),
  status: z.enum(['proposed', 'approved', 'rejected']),
  rationale: z.string(),
  requiredDisclosures: z.array(z.string()),
  forbiddenImplications: z.array(z.string()),
  markets: z.array(z.string()),
  channels: z.array(z.string()),
  citations: z.array(productIngestionCitationSchema),
  generatedBy: z.string(),
})

export const productIngestionComplianceCheckSchema = z.object({
  inputClaim: z.string(),
  decision: z.enum(['pass', 'fail', 'needs_human_review']),
  rationale: z.string(),
  citedDocumentIds: z.array(z.string()),
})

export const productIngestionOutputSchema = z.object({
  productId: z.uuid(),
  organizationId: z.string().min(1),
  workflowId: z.string(),
  input: productIngestionFieldSchema,
  facts: z.array(productIngestionFactSchema),
  approvedClaims: z.array(productIngestionApprovedClaimSchema),
  complianceChecks: z.array(productIngestionComplianceCheckSchema),
  sourceDocumentsUsed: z.array(productIngestionCitationSchema),
})

export type ProductIngestionInput = z.infer<typeof productIngestionInputSchema>
export type ProductIngestionOutput = z.infer<typeof productIngestionOutputSchema>
export type ProductIngestionApprovedClaim = z.infer<
  typeof productIngestionApprovedClaimSchema
>
export type ProductIngestionCitation = z.infer<typeof productIngestionCitationSchema>
export type ProductIngestionComplianceCheck = z.infer<
  typeof productIngestionComplianceCheckSchema
>

export function buildProductIngestionOutput(input: {
  productId: string
  organizationId: string
  label: string
  sourceUrl: string
  claims: string | null
  evidence: string | null
  brandVoice: string | null
}): ProductIngestionOutput {
  const facts: unknown[] = [
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
  ]
  const claimsFact = optionalFact('claims', input.claims, 'form_claims')
  const evidenceFact = optionalFact('evidence', input.evidence, 'form_evidence')
  const brandVoiceFact = optionalFact(
    'brand_voice',
    input.brandVoice,
    'form_brand_voice',
  )

  if (claimsFact) facts.push(claimsFact)
  if (evidenceFact) facts.push(evidenceFact)
  if (brandVoiceFact) facts.push(brandVoiceFact)

  const output = {
    productId: input.productId,
    organizationId: input.organizationId,
    workflowId: 'passthrough',
    input: {
      label: input.label,
      sourceUrl: input.sourceUrl,
      claims: input.claims,
      evidence: input.evidence,
      brandVoice: input.brandVoice,
    },
    facts,
    approvedClaims: [],
    complianceChecks: [],
    sourceDocumentsUsed: [],
  }

  return productIngestionOutputSchema.parse(output)
}

export function productFactsFromOutput(
  output: ProductIngestionOutput,
): ProductFactInput[] {
  return output.facts.map((fact) => ({
    category: fact.category,
    statement: fact.statement,
    source: fact.source,
    sourceExcerpt: fact.sourceExcerpt,
    confidence: fact.confidence,
  }))
}

function optionalFact(
  category: 'claims' | 'evidence' | 'brand_voice',
  value: string | null,
  source: 'form_claims' | 'form_evidence' | 'form_brand_voice',
) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  return {
    category,
    statement: trimmed,
    source,
    sourceExcerpt: trimmed,
    confidence: 1,
  } as const
}
