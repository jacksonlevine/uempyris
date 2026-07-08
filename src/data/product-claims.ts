import crypto from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { productApprovedClaims } from '#/db/schema.ts'

import type { InferInsertModel } from 'drizzle-orm'

export type ProductApprovedClaimInput = Omit<
  InferInsertModel<typeof productApprovedClaims>,
  'createdAt' | 'reviewedAt'
> & {
  reviewedAt?: string | null
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

export async function updateProductApprovedClaim(input: {
  organizationId: string
  productId: string
  claimId: string
  claimText: string
}) {
  const [row] = await db
    .update(productApprovedClaims)
    .set({
      claimText: input.claimText,
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
