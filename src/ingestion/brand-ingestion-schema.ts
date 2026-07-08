import * as z from 'zod'

export const brandIngestionInputSchema = z.object({
  organizationId: z.string().min(1),
  brandId: z.uuid(),
  productId: z.uuid(),
  productLabel: z.string().min(1),
  productUrl: z.url(),
})

export const brandIngestionCitationSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
})

export const brandDnaSnapshotSchema = z.object({
  brandName: z.string().min(1),
  productUrl: z.url(),
  brandDnaMarkdown: z.string().min(1),
  imagePromptModifier: z.string().min(1),
  citations: z.array(brandIngestionCitationSchema).default([]),
  model: z.string().min(1),
})

export const brandIngestionOutputSchema = z.object({
  productId: z.uuid(),
  organizationId: z.string().min(1),
  brandId: z.uuid(),
  workflowId: z.string(),
  cached: z.boolean(),
  snapshot: brandDnaSnapshotSchema,
})

export type BrandIngestionInput = z.infer<typeof brandIngestionInputSchema>
export type BrandDnaSnapshot = z.infer<typeof brandDnaSnapshotSchema>
export type BrandIngestionOutput = z.infer<typeof brandIngestionOutputSchema>
