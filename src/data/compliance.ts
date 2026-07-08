import crypto from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import {
  complianceSourceDocuments,
  productApprovedClaims,
} from '#/db/schema.ts'

import type { InferInsertModel } from 'drizzle-orm'

export type ComplianceSourceDocumentInput = InferInsertModel<
  typeof complianceSourceDocuments
>

export type ProductApprovedClaimInput = Omit<
  InferInsertModel<typeof productApprovedClaims>,
  'createdAt' | 'reviewedAt'
> & {
  reviewedAt?: string | null
}

export async function countComplianceSourceDocuments() {
  const rows = await db.select({ id: complianceSourceDocuments.id }).from(complianceSourceDocuments).limit(1)
  return rows.length
}

export async function upsertComplianceSourceDocuments(
  documents: ComplianceSourceDocumentInput[],
) {
  if (documents.length === 0) return

  for (const document of documents) {
    await db
      .insert(complianceSourceDocuments)
      .values(document)
      .onConflictDoUpdate({
        target: complianceSourceDocuments.id,
        set: {
          url: document.url,
          title: document.title,
          sourceType: document.sourceType,
          authority: document.authority ?? null,
          jurisdiction: document.jurisdiction ?? 'US',
          productCategory: document.productCategory ?? 'dietary_supplement',
          contentMarkdown: document.contentMarkdown,
          contentHash: document.contentHash ?? null,
          status: document.status ?? 'approved',
          metadata: document.metadata ?? {},
          updatedAt: new Date().toISOString(),
        },
      })
  }
}

export async function listApprovedComplianceSourceDocuments(limit = 300) {
  return db.query.complianceSourceDocuments.findMany({
    where: eq(complianceSourceDocuments.status, 'approved'),
    limit,
    orderBy: (table, { asc }) => [asc(table.title)],
  })
}

export function listProductApprovedClaims(
  organizationId: string,
  productId: string,
) {
  return db
    .select()
    .from(productApprovedClaims)
    .where(
      and(
        eq(productApprovedClaims.orgId, organizationId),
        eq(productApprovedClaims.productId, productId),
      ),
    )
    .orderBy(productApprovedClaims.createdAt)
}

export async function updateProductApprovedClaimStatus(input: {
  organizationId: string
  productId: string
  claimId: string
  status: 'approved' | 'rejected'
}) {
  const [row] = await db
    .update(productApprovedClaims)
    .set({
      status: input.status,
      reviewedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(productApprovedClaims.orgId, input.organizationId),
        eq(productApprovedClaims.productId, input.productId),
        eq(productApprovedClaims.id, input.claimId),
      ),
    )
    .returning()
  return row
}

export async function replaceProductApprovedClaims(
  organizationId: string,
  productId: string,
  claims: ProductApprovedClaimInput[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(productApprovedClaims)
      .where(
        and(
          eq(productApprovedClaims.orgId, organizationId),
          eq(productApprovedClaims.productId, productId),
        ),
      )

    if (claims.length > 0) {
      await tx.insert(productApprovedClaims).values(claims)
    }
  })
}

export function approvedClaimId(input: {
  productId: string
  claimText: string
  salt?: string
}) {
  return `claim_${crypto
    .createHash('sha256')
    .update(`${input.productId}:${input.claimText}:${input.salt ?? ''}`)
    .digest('hex')
    .slice(0, 16)}`
}
