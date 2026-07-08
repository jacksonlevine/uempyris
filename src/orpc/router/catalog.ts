import { ORPCError, os } from '@orpc/server'
import * as z from 'zod'

import {
  addBrandForOrganization,
  addProductForOrganization,
  listBrandsForOrganization,
  listProductsForBrand,
} from '#/data/catalog.ts'
import {
  approveBrandIngestionProposal,
  getBrandVoiceForBrand,
  getBrandIngestionState,
  updateBrandVoiceForBrand,
} from '#/data/brand-ingestion.ts'
import {
  listProductApprovedClaims,
  updateProductApprovedClaimStatus,
} from '#/data/compliance.ts'
import { getProductIngestionState } from '#/data/ingestion.ts'

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
      brandId: z.uuid().optional(),
      name: z.string().min(1).max(200),
      sourceUrl: z.url(),
    }),
  )
  .handler(async ({ input, context }) => {
    return addProductForOrganization(context.organizationId, input)
  })

export const getIngestionState = authed
  .input(z.object({ productId: z.uuid() }))
  .handler(({ input, context }) =>
    getProductIngestionState(context.organizationId, input.productId),
  )

export const getBrandIngestionStateForProduct = authed
  .input(z.object({ productId: z.uuid() }))
  .handler(({ input, context }) =>
    getBrandIngestionState(context.organizationId, input.productId),
  )

export const getBrandVoice = authed
  .input(z.object({ brandId: z.uuid() }))
  .handler(({ input, context }) =>
    getBrandVoiceForBrand(context.organizationId, input.brandId),
  )

export const updateBrandVoice = authed
  .input(
    z.object({
      brandId: z.uuid(),
      brandName: z.string().min(1).max(200),
      productUrl: z.url().optional().or(z.literal('')),
      brandDnaMarkdown: z.string().min(1),
      imagePromptModifier: z.string().min(1),
      citations: z
        .array(
          z.object({
            url: z.string().min(1),
            title: z.string().optional(),
          }),
        )
        .default([]),
      model: z.string().optional(),
    }),
  )
  .handler(async ({ input, context }) => {
    await updateBrandVoiceForBrand({
      organizationId: context.organizationId,
      ...input,
    })
    return { ok: true }
  })

export const listApprovedClaims = authed
  .input(z.object({ productId: z.uuid() }))
  .handler(({ input, context }) =>
    listProductApprovedClaims(context.organizationId, input.productId),
  )

export const updateApprovedClaimStatus = authed
  .input(
    z.object({
      productId: z.uuid(),
      claimId: z.string().min(1),
      status: z.enum(['approved', 'rejected']),
    }),
  )
  .handler(async ({ input, context }) => {
    const row = await updateProductApprovedClaimStatus({
      organizationId: context.organizationId,
      productId: input.productId,
      claimId: input.claimId,
      status: input.status,
    })
    if (!row) throw new ORPCError('NOT_FOUND')
    return row
  })

export const approveBrandIngestion = authed
  .input(
    z.object({
      brandId: z.uuid(),
      productId: z.uuid(),
      brandName: z.string().min(1).max(200),
      productUrl: z.url(),
      brandDnaMarkdown: z.string().min(1),
      imagePromptModifier: z.string().min(1),
      citations: z
        .array(
          z.object({
            url: z.string().min(1),
            title: z.string().optional(),
          }),
        )
        .default([]),
      model: z.string().min(1),
    }),
  )
  .handler(async ({ input, context }) => {
    await approveBrandIngestionProposal({
      organizationId: context.organizationId,
      ...input,
    })
    return { ok: true }
  })
