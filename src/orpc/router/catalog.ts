import { ORPCError, os } from '@orpc/server'
import * as z from 'zod'

import {
  addBrandForOrganization,
  addProductForOrganization,
  listBrandsForOrganization,
  listProductsForBrand,
} from '#/data/catalog.ts'

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
  listBrandsForOrganization(context.organizationId),
)

export const listProducts = authed
  .input(z.object({ brandId: z.uuid() }))
  .handler(({ input, context }) =>
    listProductsForBrand(context.organizationId, input.brandId),
  )

export const addBrand = authed
  .input(z.object({ name: z.string().min(1).max(200) }))
  .handler(async ({ input, context }) => {
    return addBrandForOrganization(context.organizationId, input.name)
  })

export const addProduct = authed
  .input(
    z.object({
      brandId: z.uuid(),
      name: z.string().min(1).max(200),
    }),
  )
  .handler(async ({ input, context }) => {
    return addProductForOrganization(context.organizationId, input)
  })
