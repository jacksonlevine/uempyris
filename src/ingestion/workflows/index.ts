import { complianceApprovedClaimsWorkflow } from './compliance-approved-claims.ts'

import type { ProductIngestionWorkflow } from './types.ts'

const workflows = {
  [complianceApprovedClaimsWorkflow.id]: complianceApprovedClaimsWorkflow,
} satisfies Record<string, ProductIngestionWorkflow>

export function getProductIngestionWorkflow() {
  const workflowId =
    process.env.PRODUCT_INGESTION_WORKFLOW_ID ?? complianceApprovedClaimsWorkflow.id
  const workflow = workflows[workflowId]

  if (!workflow) {
    throw new Error(`Unknown product ingestion workflow: ${workflowId}`)
  }

  return workflow
}
