import { and, desc, eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { marketResearch, productFacts, products } from '#/db/schema.ts'

import type { InferInsertModel } from 'drizzle-orm'

export type ProductFactInput = Omit<
  InferInsertModel<typeof productFacts>,
  'id' | 'productId' | 'orgId' | 'createdAt'
>

export function getProductForIngestion(
  organizationId: string,
  productId: string,
) {
  return db.query.products.findFirst({
    where: and(
      eq(products.id, productId),
      eq(products.orgId, organizationId),
    ),
  })
}

export function listProductFacts(organizationId: string, productId: string) {
  return db
    .select()
    .from(productFacts)
    .where(
      and(
        eq(productFacts.orgId, organizationId),
        eq(productFacts.productId, productId),
      ),
    )
    .orderBy(productFacts.id)
}

export async function getProductIngestionState(
  organizationId: string,
  productId: string,
) {
  const [run] = await db
    .select()
    .from(marketResearch)
    .where(
      and(
        eq(marketResearch.orgId, organizationId),
        eq(marketResearch.productId, productId),
      ),
    )
    .orderBy(desc(marketResearch.createdAt))
    .limit(1)

  return run ?? null
}

export async function markIngestionRunning(
  organizationId: string,
  productId: string,
) {
  await db
    .update(marketResearch)
    .set({ status: 'running' })
    .where(
      and(
        eq(marketResearch.orgId, organizationId),
        eq(marketResearch.productId, productId),
      ),
    )
}

export async function markIngestionQueued(
  organizationId: string,
  productId: string,
  runId: string | null,
) {
  await db.insert(marketResearch).values({
    orgId: organizationId,
    productId,
    status: 'pending',
    content: runId,
  })
}

export async function writeProductFacts(
  organizationId: string,
  productId: string,
  facts: ProductFactInput[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(productFacts)
      .where(
        and(
          eq(productFacts.orgId, organizationId),
          eq(productFacts.productId, productId),
        ),
      )

    if (facts.length > 0) {
      await tx.insert(productFacts).values(
        facts.map((fact) => ({
          ...fact,
          productId,
          orgId: organizationId,
        })),
      )
    }

    await tx
      .update(marketResearch)
      .set({ status: 'completed' })
      .where(
        and(
          eq(marketResearch.orgId, organizationId),
          eq(marketResearch.productId, productId),
        ),
      )
  })
}

export async function markIngestionFailed(
  organizationId: string,
  productId: string,
  error: unknown,
) {
  await db
    .update(marketResearch)
    .set({
      status: 'failed',
      content: error instanceof Error ? error.message : String(error),
    })
    .where(
      and(
        eq(marketResearch.orgId, organizationId),
        eq(marketResearch.productId, productId),
      ),
    )
}
