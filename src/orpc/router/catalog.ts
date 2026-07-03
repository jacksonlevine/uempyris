import { ORPCError, os } from '@orpc/server'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { and, eq } from 'drizzle-orm'
import * as z from 'zod'

import { db } from '#/db/index.ts'
import { brands, products } from '#/db/schema.ts'

// Server-side copy of the client id; falls back to the VITE_ var so dev
// works even if only the client-side one is set.
const clientId =
  process.env.WORKOS_CLIENT_ID ?? process.env.VITE_WORKOS_CLIENT_ID
if (!clientId) {
  throw new Error('Missing WORKOS_CLIENT_ID env variable')
}

// WorkOS publishes the public keys that sign its access tokens here.
// jose caches them and re-fetches on key rotation.
const jwks = createRemoteJWKSet(
  new URL(`https://api.workos.com/sso/jwks/${clientId}`),
)

const base = os.$context<{ headers: Headers }>()

// Verifies the Bearer token's signature and extracts the org. Everything
// tenant-scoped builds on `authed` — org id always comes from the verified
// token, never from client input.
const authed = base.use(async ({ context, next }) => {
  const token = context.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) throw new ORPCError('UNAUTHORIZED')
  try {
    const { payload } = await jwtVerify(token, jwks)
    if (typeof payload.org_id !== 'string') {
      throw new Error('session not org-bound')
    }
    return next({
      context: { organizationId: payload.org_id, userId: payload.sub! },
    })
  } catch {
    throw new ORPCError('UNAUTHORIZED')
  }
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
