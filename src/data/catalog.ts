import { and, eq, inArray } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { brands, productFacts, products } from '#/db/schema.ts'
import { enqueueBrandIngestion } from '#/ingestion/enqueue-brand.ts'
import { enqueueProductIngestion } from '#/ingestion/enqueue.ts'

export type AddProductInput = {
  brandId?: string
  name: string
  sourceUrl: string
}

export function listBrandsForOrganization(organizationId: string) {
  return db
    .select()
    .from(brands)
    .where(eq(brands.orgId, organizationId))
    .orderBy(brands.id)
}

export async function listProductsForBrand(organizationId: string, brandId: string) {
  const rows = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.brandId, brandId),
        eq(products.orgId, organizationId),
      ),
    )
    .orderBy(products.id)

  if (rows.length === 0) return []

  const imageFacts = await db
    .select()
    .from(productFacts)
    .where(
      and(
        eq(productFacts.orgId, organizationId),
        eq(productFacts.category, 'product_image'),
        inArray(productFacts.productId, rows.map((product) => product.id)),
      ),
    )
    .orderBy(productFacts.id)

  const primaryImageByProduct = new Map<string, string>()
  for (const fact of imageFacts) {
    if (!primaryImageByProduct.has(fact.productId)) {
      primaryImageByProduct.set(fact.productId, fact.statement)
    }
  }

  return rows.map((product) => ({
    ...product,
    primaryImageUrl: primaryImageByProduct.get(product.id) ?? null,
  }))
}

export async function addBrandForOrganization(
  organizationId: string,
  name: string,
) {
  const [row] = await db
    .insert(brands)
    .values({ name, orgId: organizationId })
    .returning()
  return row
}

export async function addProductForOrganization(
  organizationId: string,
  input: AddProductInput,
) {
  const row = await db.transaction(async (tx) => {
    let brandId = input.brandId

    if (brandId) {
      const existingBrand = await tx.query.brands.findFirst({
        where: and(
          eq(brands.id, brandId),
          eq(brands.orgId, organizationId),
        ),
      })
      if (!existingBrand) {
        throw new Error('Brand not found for organization')
      }
    } else {
      const [brand] = await tx
        .insert(brands)
        .values({
          name: brandNameFromProductLink(input.sourceUrl, input.name),
          orgId: organizationId,
        })
        .returning()
      if (!brand) throw new Error('Creating brand from product link failed')
      brandId = brand.id
    }

    const [product] = await tx
      .insert(products)
      .values({
        brandId,
        name: input.name,
        orgId: organizationId,
      })
      .returning()
    if (!product) throw new Error('Creating product failed')

    await tx.insert(productFacts).values([
      {
        productId: product.id,
        orgId: organizationId,
        category: 'label',
        statement: input.name,
        source: 'form_label',
        sourceExcerpt: input.name,
        confidence: 1,
      },
      {
        productId: product.id,
        orgId: organizationId,
        category: 'source_url',
        statement: input.sourceUrl,
        source: 'url',
        sourceExcerpt: input.sourceUrl,
        confidence: 1,
      },
    ])

    return { ...product, primaryImageUrl: null }
  })

  await Promise.all([
    enqueueProductIngestion({
      organizationId,
      productId: row.id,
      sourceUrl: input.sourceUrl,
      label: input.name,
    }),
    enqueueBrandIngestion({
      organizationId,
      brandId: row.brandId,
      productId: row.id,
      productLabel: input.name,
      productUrl: input.sourceUrl,
    }),
  ])

  return row
}

function brandNameFromProductLink(sourceUrl: string, fallback: string) {
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, '')
    const [name] = host.split('.')
    return name ? titleCase(name.replace(/[-_]+/g, ' ')) : fallback
  } catch {
    return fallback
  }
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}
