import type { ProductIngestionOutput } from '#/ingestion/product-ingestion-schema.ts'

export type ProductIngestionWorkflowInput = {
  productId: string
  organizationId: string
  label: string
  sourceUrl: string
  claims: string | null
  evidence: string | null
  brandVoice: string | null
}

export type ProductIngestionWorkflow = {
  id: string
  run: (input: ProductIngestionWorkflowInput) => Promise<ProductIngestionOutput>
}
