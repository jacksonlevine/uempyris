import * as z from 'zod'

import {
  countComplianceSourceDocuments,
  listApprovedComplianceSourceDocuments,
  upsertComplianceSourceDocuments,
} from '#/data/compliance.ts'
import approvedClaimsSeed from './corpus/approved-claims.seed.json'
import documentsSeed from './corpus/documents.json'

import type { ComplianceSourceDocumentInput } from '#/data/compliance.ts'

type ComplianceSourceDocumentStatus = NonNullable<
  ComplianceSourceDocumentInput['status']
>

const corpusDocumentSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  title: z.string().optional(),
  sourceType: z.string().optional(),
  authority: z.string().nullable().optional(),
  content: z.string().optional(),
  contentFingerprint: z.string().nullable().optional(),
  status: z.string().optional(),
  reviewedAt: z.string().nullable().optional(),
  crawledAt: z.string().nullable().optional(),
})

const corpusClaimCitationSchema = z.object({
  documentId: z.string().optional(),
  title: z.string().optional(),
  authority: z.string().optional(),
  sourceType: z.string().optional(),
  url: z.string().optional(),
})

const corpusApprovedClaimSchema = z.object({
  id: z.string(),
  product: z.string().optional(),
  claimText: z.string(),
  claimType: z.string().optional(),
  status: z.enum(['proposed', 'approved', 'rejected']).optional(),
  rationale: z.string().optional(),
  requiredDisclosures: z.array(z.string()).optional(),
  forbiddenImplications: z.array(z.string()).optional(),
  markets: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
  citations: z.array(corpusClaimCitationSchema).optional(),
})

export type ComplianceDocument = Awaited<
  ReturnType<typeof listApprovedComplianceSourceDocuments>
>[number]

export type SeedApprovedClaim = z.infer<typeof corpusApprovedClaimSchema>

export async function ensureComplianceCorpusSeeded() {
  if (await countComplianceSourceDocuments()) return

  const documents = z
    .array(corpusDocumentSchema)
    .parse(documentsSeed)
    .filter((document) => document.url && document.content)
    .map((document) => {
      const status: ComplianceSourceDocumentStatus =
        document.status === 'pending' || document.status === 'rejected'
          ? document.status
          : 'approved'

      return {
        id: document.id,
        url: document.url,
        title: document.title || document.url,
        sourceType: document.sourceType || 'unknown',
        authority: document.authority ?? null,
        jurisdiction: 'US',
        productCategory: 'dietary_supplement',
        contentMarkdown: document.content || '',
        contentHash: document.contentFingerprint ?? null,
        status,
        metadata: {
          reviewedAt: document.reviewedAt,
          crawledAt: document.crawledAt,
        },
        createdAt: document.crawledAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })

  await upsertComplianceSourceDocuments(documents)
}

export async function loadSeedApprovedClaims() {
  return z
    .array(corpusApprovedClaimSchema)
    .parse(approvedClaimsSeed)
}
