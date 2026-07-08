import { productClaimsWorkflow } from './product-claims.ts'

import type { ProductIngestionWorkflow } from './types.ts'

const workflows = {
  [productClaimsWorkflow.id]: productClaimsWorkflow,
} satisfies Record<string, ProductIngestionWorkflow>

export function getProductIngestionWorkflow() {
  const workflowId =
    process.env.PRODUCT_INGESTION_WORKFLOW_ID ?? productClaimsWorkflow.id
  const workflow = workflows[workflowId]

  if (!workflow) {
    throw new Error(`Unknown product ingestion workflow: ${workflowId}`)
  }

  return workflow
}
