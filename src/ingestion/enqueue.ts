import { tasks } from '@trigger.dev/sdk'

import { markIngestionFailed, markIngestionQueued } from '#/data/ingestion.ts'

import type { productIngestionTask } from '#/trigger/product-ingestion.ts'

export async function enqueueProductIngestion(input: {
  organizationId: string
  productId: string
  sourceUrl?: string
  label?: string
  idempotencyKey?: string
}) {
  if (!process.env.TRIGGER_SECRET_KEY) {
    await markIngestionQueued(input.organizationId, input.productId, null)
    return null
  }

  try {
    const handle = await tasks.trigger<typeof productIngestionTask>(
      'product-ingestion',
      {
        organizationId: input.organizationId,
        productId: input.productId,
        sourceUrl: input.sourceUrl,
        label: input.label,
      },
      {
        idempotencyKey:
          input.idempotencyKey ?? `product-ingestion-${input.productId}`,
      },
    )

    await markIngestionQueued(input.organizationId, input.productId, handle.id)
    return handle
  } catch (error) {
    await markIngestionFailed(input.organizationId, input.productId, error)
    return null
  }
}
