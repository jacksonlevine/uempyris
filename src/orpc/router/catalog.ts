import { ORPCError, os } from '@orpc/server'
import { and, eq } from 'drizzle-orm'
import * as z from 'zod'

import { db } from '#/db/index.ts'
import { brands, products } from '#/db/schema.ts'

import type { NoUserInfo, UserInfo } from '@workos/authkit-tanstack-react-start'

// The route handlers resolve the AuthKit session (httpOnly cookie) and pass
// it in as initial context. Everything tenant-scoped builds on `authed` —
// org id always comes from the verified session, never from client input.
const base = os.$context<{ auth: UserInfo | NoUserInfo }>()

const authed = base.use(async ({ context, next }) => {
  const { auth } = context
  if (!auth.user || !auth.organizationId) throw new ORPCError('UNAUTHORIZED')
  return next({
    context: { organizationId: auth.organizationId, userId: auth.user.id },
  })
})

export const listBrands = authed.handler(({ context }) =>
  db
    .select()
    .from(brands)
    .where(eq(brands.organizationId, context.organizationId))
    .orderBy(brands.id),
)

export const listProducts = authed
  .input(z.object({ brandId: z.number().int() }))
  .handler(({ input, context }) =>
    db
      .select()
      .from(products)
      .where(
        and(
          eq(products.brandId, input.brandId),
          // Tenant guard: a guessed brandId from another org returns nothing.
          eq(products.organizationId, context.organizationId),
        ),
      )
      .orderBy(products.id),
  )

export const addBrand = authed
  .input(z.object({ name: z.string().min(1).max(200) }))
  .handler(async ({ input, context }) => {
    const [row] = await db
      .insert(brands)
      .values({ name: input.name, organizationId: context.organizationId })
      .returning()
    return row
  })

export const addProduct = authed
  .input(z.object({ brandId: z.number().int(), name: z.string().min(1).max(200) }))
  .handler(async ({ input, context }) => {
    // If brandId belongs to another org, the composite FK rejects the insert.
    const [row] = await db
      .insert(products)
      .values({
        brandId: input.brandId,
        name: input.name,
        organizationId: context.organizationId,
      })
      .returning()
    return row
  })
