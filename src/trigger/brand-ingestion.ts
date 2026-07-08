import { logger, task } from '@trigger.dev/sdk'

import {
  getBrandProductForIngestion,
  markBrandIngestionFailed,
  markBrandIngestionRunning,
  persistBrandIngestionOutput,
} from '#/data/brand-ingestion.ts'
import { brandIngestionInputSchema } from '#/ingestion/brand-ingestion-schema.ts'
import { runBrandIngestionWorkflow } from '#/ingestion/workflows/brand-ingestion.ts'

import type { BrandIngestionInput } from '#/ingestion/brand-ingestion-schema.ts'

export const brandIngestionTask = task({
  id: 'brand-ingestion',
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: BrandIngestionInput) => {
    const input = brandIngestionInputSchema.parse(payload)

    try {
      const product = await getBrandProductForIngestionChecked(input)
      await markBrandIngestionRunning(input)

      const output = await runBrandIngestionWorkflow({
        ...input,
        productLabel: input.productLabel || product.name,
      })
      await persistBrandIngestionOutput(output)

      logger.info('Brand ingestion completed', {
        productId: input.productId,
        brandId: input.brandId,
        brandName: output.snapshot.brandName,
      })

      return output
    } catch (error) {
      await markBrandIngestionFailed(input, error)
      throw error
    }
  },
})

async function getBrandProductForIngestionChecked(input: BrandIngestionInput) {
  const product = await getBrandProductForIngestion(input)
  if (!product) {
    throw new Error('Product not found for brand ingestion')
  }
  return product
}
