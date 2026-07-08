import { logger, task } from '@trigger.dev/sdk'

import { replaceProductApprovedClaims } from '#/data/compliance.ts'
import {
  getProductForIngestion,
  markIngestionFailed,
  markIngestionRunning,
  writeProductFacts,
} from '#/data/ingestion.ts'
import {
  productFactsFromOutput,
  productIngestionInputSchema,
} from '#/ingestion/product-ingestion-schema.ts'
import { getProductIngestionWorkflow } from '#/ingestion/workflows/index.ts'

import type { ProductIngestionInput } from '#/ingestion/product-ingestion-schema.ts'

export const productIngestionTask = task({
  id: 'product-ingestion',
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: ProductIngestionInput) => {
    const input = productIngestionInputSchema.parse(payload)

    try {
      const product = await getProductForIngestion(
        input.organizationId,
        input.productId,
      )

      if (!product) {
        throw new Error('Product not found for ingestion')
      }

      await markIngestionRunning(input.organizationId, input.productId)

      const workflow = getProductIngestionWorkflow()
      const output = await workflow.run({
        productId: input.productId,
        organizationId: input.organizationId,
        label: input.label ?? product.name,
        sourceUrl: input.sourceUrl ?? '',
        claims: null,
        evidence: null,
        brandVoice: null,
      })
      const facts = productFactsFromOutput(output)

      await writeProductFacts(
        input.organizationId,
        input.productId,
        facts,
      )
      await replaceProductApprovedClaims(
        input.organizationId,
        input.productId,
        output.approvedClaims.map((claim) => ({
          id: claim.id,
          orgId: input.organizationId,
          productId: input.productId,
          claimText: claim.claimText,
          claimType: claim.claimType,
          status: claim.status,
          rationale: claim.rationale,
          reviewDecision: null,
          requiredDisclosures: claim.requiredDisclosures,
          forbiddenImplications: claim.forbiddenImplications,
          markets: claim.markets,
          channels: claim.channels,
          citations: claim.citations,
          generatedBy: claim.generatedBy,
          reviewedAt: null,
        })),
      )

      logger.info('Product ingestion completed', {
        productId: input.productId,
        workflowId: output.workflowId,
        factCount: facts.length,
        approvedClaimCount: output.approvedClaims.length,
      })

      return output
    } catch (error) {
      await markIngestionFailed(
        input.organizationId,
        input.productId,
        error,
      )
      throw error
    }
  },
})
