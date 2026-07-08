"use client"

import * as React from "react"
import { CheckIcon, PencilIcon, SaveIcon, XIcon } from "lucide-react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Button } from "#/components/ui/button.tsx"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "#/components/ui/card.tsx"
import { Label } from "#/components/ui/label.tsx"
import { Textarea } from "#/components/ui/textarea.tsx"
import { cn } from "#/lib/utils.ts"
import { orpc } from "#/orpc/client.ts"

export type ProductClaim = {
  id: string
  productId?: string
  claimText: string
  status: "proposed" | "approved" | "rejected"
}

type ClaimDraft = {
  claimText: string
}

export function ProductClaimsList({
  productId,
  claims,
  emptyText = "No claims have been generated for this product yet.",
  showReviewActions = false,
}: {
  productId: string
  claims: ProductClaim[]
  emptyText?: string
  showReviewActions?: boolean
}) {
  const queryClient = useQueryClient()
  const [editingClaimId, setEditingClaimId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<ClaimDraft | null>(null)

  const updateClaim = useMutation(
    orpc.updateApprovedClaim.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.listApprovedClaims.key() })
        setEditingClaimId(null)
        setDraft(null)
        toast.success("Claim saved")
      },
      onError: (error) => toast.error(`Saving claim failed: ${error.message}`),
    }),
  )

  const updateClaimStatus = useMutation(
    orpc.updateApprovedClaimStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.listApprovedClaims.key() })
      },
      onError: (error) =>
        toast.error(`Updating claim failed: ${error.message}`),
    }),
  )

  function beginEdit(claim: ProductClaim) {
    setEditingClaimId(claim.id)
    setDraft({
      claimText: claim.claimText,
    })
  }

  function saveEdit(claim: ProductClaim) {
    if (!draft) return
    updateClaim.mutate({
      productId,
      claimId: claim.id,
      claimText: draft.claimText.trim(),
    })
  }

  function setClaimStatus(claim: ProductClaim, status: "approved" | "rejected") {
    updateClaimStatus.mutate({
      productId,
      claimId: claim.id,
      status,
    })
  }

  if (claims.length === 0) {
    return (
      <Card size="sm">
        <CardContent className="py-6 text-sm text-muted-foreground">
          {emptyText}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-3">
      {claims.map((claim) => {
        const editing = editingClaimId === claim.id && draft

        return (
          <Card key={claim.id} size="sm">
            <CardHeader>
              {editing ? (
                <div className="grid gap-2">
                  <Label htmlFor={`claim-text-${claim.id}`}>Claim</Label>
                  <Textarea
                    id={`claim-text-${claim.id}`}
                    value={draft.claimText}
                    onChange={(event) =>
                      setDraft({ ...draft, claimText: event.target.value })
                    }
                  />
                </div>
              ) : (
                <>
                  <CardTitle className="normal-case tracking-normal">
                    {claim.claimText}
                  </CardTitle>
                </>
              )}
              <CardAction className="flex items-start gap-2">
                <ClaimStatus status={claim.status} />
                {!editing ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => beginEdit(claim)}
                  >
                    <PencilIcon />
                    Edit
                  </Button>
                ) : null}
              </CardAction>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="grid gap-4">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updateClaim.isPending}
                      onClick={() => {
                        setEditingClaimId(null)
                        setDraft(null)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={updateClaim.isPending || !draft.claimText.trim()}
                      onClick={() => saveEdit(claim)}
                    >
                      <SaveIcon />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {showReviewActions ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={updateClaimStatus.isPending}
                        onClick={() => setClaimStatus(claim, "rejected")}
                      >
                        <XIcon />
                        Reject
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={updateClaimStatus.isPending}
                        onClick={() => setClaimStatus(claim, "approved")}
                      >
                        <CheckIcon />
                        Approve
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function ClaimStatus({ status }: { status: ProductClaim["status"] }) {
  return (
    <span
      className={cn(
        "border px-2 py-1 text-xs font-medium uppercase",
        status === "approved" && "border-primary/30 bg-primary/10 text-primary",
        status === "rejected" && "border-destructive/30 bg-destructive/10 text-destructive",
        status === "proposed" && "text-muted-foreground",
      )}
    >
      {status}
    </span>
  )
}
