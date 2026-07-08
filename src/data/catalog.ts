import { and, eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { brands, products } from '#/db/schema.ts'

export type AddProductInput = {
  brandId: string
  name: string
}

export function listBrandsForOrganization(organizationId: string) {
  return db
    .select()
    .from(brands)
    .where(eq(brands.orgId, organizationId))
    .orderBy(brands.id)
}

export function listProductsForBrand(organizationId: string, brandId: string) {
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.brandId, brandId),
        eq(products.orgId, organizationId),
      ),
    )
    .orderBy(products.id)
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
  const [row] = await db
    .insert(products)
    .values({
      brandId: input.brandId,
      name: input.name,
      orgId: organizationId,
    })
    .returning()
  return row
}
