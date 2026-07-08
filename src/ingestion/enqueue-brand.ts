import { tasks } from '@trigger.dev/sdk'

import {
  markBrandIngestionFailed,
  markBrandIngestionQueued,
} from '#/data/brand-ingestion.ts'

import type { brandIngestionTask } from '#/trigger/brand-ingestion.ts'

export async function enqueueBrandIngestion(input: {
  organizationId: string
  brandId: string
  productId: string
  productLabel: string
  productUrl: string
  idempotencyKey?: string
}) {
  if (!process.env.TRIGGER_SECRET_KEY) {
    await markBrandIngestionQueued({ ...input, triggerRunId: null })
    return null
  }

  try {
    const handle = await tasks.trigger<typeof brandIngestionTask>(
      'brand-ingestion',
      {
        organizationId: input.organizationId,
        brandId: input.brandId,
        productId: input.productId,
        productLabel: input.productLabel,
        productUrl: input.productUrl,
      },
      {
        idempotencyKey:
          input.idempotencyKey ?? `brand-ingestion-${input.productId}`,
      },
    )

    await markBrandIngestionQueued({ ...input, triggerRunId: handle.id })
    return handle
  } catch (error) {
    await markBrandIngestionFailed(input, error)
    return null
  }
}
