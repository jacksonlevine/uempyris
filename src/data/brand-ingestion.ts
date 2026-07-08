import { and, desc, eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { brandIngestionRuns, brandKb, brands, products } from '#/db/schema.ts'
import type { BrandIngestionOutput } from '#/ingestion/brand-ingestion-schema.ts'

export function getBrandProductForIngestion(input: {
  organizationId: string
  brandId: string
  productId: string
}) {
  return db.query.products.findFirst({
    where: and(
      eq(products.id, input.productId),
      eq(products.brandId, input.brandId),
      eq(products.orgId, input.organizationId),
    ),
  })
}

export async function markBrandIngestionQueued(input: {
  organizationId: string
  brandId: string
  productId: string
  triggerRunId: string | null
}) {
  await db.insert(brandIngestionRuns).values({
    orgId: input.organizationId,
    brandId: input.brandId,
    productId: input.productId,
    status: 'pending',
    triggerRunId: input.triggerRunId,
  })
}

export async function markBrandIngestionRunning(input: {
  organizationId: string
  brandId: string
  productId: string
}) {
  await db
    .update(brandIngestionRuns)
    .set({ status: 'running' })
    .where(runWhere(input))
}

export async function markBrandIngestionFailed(
  input: {
    organizationId: string
    brandId: string
    productId: string
  },
  error: unknown,
) {
  await db
    .update(brandIngestionRuns)
    .set({
      status: 'failed',
      content: error instanceof Error ? error.message : String(error),
    })
    .where(runWhere(input))
}

export async function persistBrandIngestionOutput(output: BrandIngestionOutput) {
  const snapshotJson = JSON.stringify(output.snapshot, null, 2)

  await db
    .update(brandIngestionRuns)
    .set({
      status: 'completed',
      content: snapshotJson,
    })
    .where(
      and(
        eq(brandIngestionRuns.orgId, output.organizationId),
        eq(brandIngestionRuns.brandId, output.brandId),
        eq(brandIngestionRuns.productId, output.productId),
      ),
    )
}

export async function approveBrandIngestionProposal(input: {
  organizationId: string
  brandId: string
  productId: string
  brandName: string
  productUrl: string
  brandDnaMarkdown: string
  imagePromptModifier: string
  citations: Array<{ url: string; title?: string }>
  model: string
}) {
  const snapshotJson = JSON.stringify(
    {
      brandName: input.brandName,
      productUrl: input.productUrl,
      brandDnaMarkdown: input.brandDnaMarkdown,
      imagePromptModifier: input.imagePromptModifier,
      citations: input.citations,
      model: input.model,
    },
    null,
    2,
  )

  await db.transaction(async (tx) => {
    await tx
      .update(brands)
      .set({ name: input.brandName })
      .where(
        and(
          eq(brands.id, input.brandId),
          eq(brands.orgId, input.organizationId),
        ),
      )

    await upsertBrandKb(tx, {
      orgId: input.organizationId,
      brandId: input.brandId,
      path: 'brand/dna.md',
      content: input.brandDnaMarkdown,
    })
    await upsertBrandKb(tx, {
      orgId: input.organizationId,
      brandId: input.brandId,
      path: 'brand/image-prompt-modifier.txt',
      content: input.imagePromptModifier,
    })
    await upsertBrandKb(tx, {
      orgId: input.organizationId,
      brandId: input.brandId,
      path: 'brand/research-snapshot.json',
      content: snapshotJson,
    })

    await tx
      .update(brandIngestionRuns)
      .set({ content: snapshotJson })
      .where(
        and(
          eq(brandIngestionRuns.orgId, input.organizationId),
          eq(brandIngestionRuns.brandId, input.brandId),
          eq(brandIngestionRuns.productId, input.productId),
        ),
      )
  })
}

export async function getBrandVoiceForBrand(
  organizationId: string,
  brandId: string,
) {
  const brand = await db.query.brands.findFirst({
    where: and(
      eq(brands.id, brandId),
      eq(brands.orgId, organizationId),
    ),
  })
  if (!brand) return null

  const rows = await db
    .select()
    .from(brandKb)
    .where(
      and(
        eq(brandKb.orgId, organizationId),
        eq(brandKb.brandId, brandId),
      ),
    )

  const rowFor = (path: string) => rows.find((row) => row.path === path)
  const snapshot = parseSnapshot(rowFor('brand/research-snapshot.json')?.content)

  return {
    brandId,
    brandName: brand.name,
    productUrl: snapshot?.productUrl ?? '',
    brandDnaMarkdown: rowFor('brand/dna.md')?.content ?? '',
    imagePromptModifier: rowFor('brand/image-prompt-modifier.txt')?.content ?? '',
    citations: normalizeCitations(snapshot?.citations),
    model: typeof snapshot?.model === 'string' ? snapshot.model : '',
    updatedAt:
      rows
        .map((row) => row.updatedAt)
        .sort()
        .at(-1) ?? brand.updatedAt,
  }
}

export async function updateBrandVoiceForBrand(input: {
  organizationId: string
  brandId: string
  brandName: string
  productUrl?: string
  brandDnaMarkdown: string
  imagePromptModifier: string
  citations?: Array<{ url: string; title?: string }>
  model?: string
}) {
  await db.transaction(async (tx) => {
    await tx
      .update(brands)
      .set({ name: input.brandName })
      .where(
        and(
          eq(brands.id, input.brandId),
          eq(brands.orgId, input.organizationId),
        ),
      )

    await upsertBrandKb(tx, {
      orgId: input.organizationId,
      brandId: input.brandId,
      path: 'brand/dna.md',
      content: input.brandDnaMarkdown,
    })
    await upsertBrandKb(tx, {
      orgId: input.organizationId,
      brandId: input.brandId,
      path: 'brand/image-prompt-modifier.txt',
      content: input.imagePromptModifier,
    })
    await upsertBrandKb(tx, {
      orgId: input.organizationId,
      brandId: input.brandId,
      path: 'brand/research-snapshot.json',
      content: JSON.stringify(
        {
          brandName: input.brandName,
          productUrl: input.productUrl ?? '',
          brandDnaMarkdown: input.brandDnaMarkdown,
          imagePromptModifier: input.imagePromptModifier,
          citations: input.citations ?? [],
          model: input.model ?? 'manual',
        },
        null,
        2,
      ),
    })
  })
}

export async function getBrandIngestionState(
  organizationId: string,
  productId: string,
) {
  const [run] = await db
    .select()
    .from(brandIngestionRuns)
    .where(
      and(
        eq(brandIngestionRuns.orgId, organizationId),
        eq(brandIngestionRuns.productId, productId),
      ),
    )
    .orderBy(desc(brandIngestionRuns.createdAt))
    .limit(1)

  return run ?? null
}

function runWhere(input: {
  organizationId: string
  brandId: string
  productId: string
}) {
  return and(
    eq(brandIngestionRuns.orgId, input.organizationId),
    eq(brandIngestionRuns.brandId, input.brandId),
    eq(brandIngestionRuns.productId, input.productId),
  )
}

function parseSnapshot(value: string | null | undefined) {
  if (!value) return null
  try {
    return JSON.parse(value) as {
      productUrl?: unknown
      citations?: unknown
      model?: unknown
    }
  } catch {
    return null
  }
}

function normalizeCitations(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (citation): citation is { url: string; title?: string } =>
        typeof citation === 'object' &&
        citation != null &&
        'url' in citation &&
        typeof citation.url === 'string',
    )
    .map((citation) =>
      typeof citation.title === 'string'
        ? { url: citation.url, title: citation.title }
        : { url: citation.url },
    )
}

async function upsertBrandKb(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  row: {
    orgId: string
    brandId: string
    path: string
    content: string
  },
) {
  await tx
    .insert(brandKb)
    .values(row)
    .onConflictDoUpdate({
      target: [brandKb.brandId, brandKb.path],
      set: {
        content: row.content,
        updatedAt: new Date().toISOString(),
      },
    })
}
