"use client"

import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type { Product } from "#/components/app-sidebar.tsx"
import {
  BrandVoiceEditor,
  type BrandVoiceDraft,
} from "#/components/brand-voice-editor.tsx"
import {
  ProductClaimsList,
  type ProductClaim,
} from "#/components/product-claims-list.tsx"
import { Button } from "#/components/ui/button.tsx"
import {
  Card,
  CardContent,
} from "#/components/ui/card.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx"
import { Input } from "#/components/ui/input.tsx"
import { Label } from "#/components/ui/label.tsx"
import { Progress } from "#/components/ui/progress.tsx"
import { cn } from "#/lib/utils.ts"
import { orpc } from "#/orpc/client.ts"

type StepId = "product" | "claims" | "brand"

const steps: Array<{ id: StepId; label: string }> = [
  { id: "product", label: "Product" },
  { id: "claims", label: "Claims" },
  { id: "brand", label: "Brand voice" },
]

export function ProductOnboardingDialog({
  open,
  activeBrandId,
  onOpenChange,
}: {
  open: boolean
  activeBrandId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [createdProduct, setCreatedProduct] = React.useState<Product | null>(null)
  const [productLabel, setProductLabel] = React.useState("")
  const [productUrl, setProductUrl] = React.useState("")
  const [activeStep, setActiveStep] = React.useState<StepId>("product")
  const [brandDraft, setBrandDraft] = React.useState<BrandVoiceDraft>({
    brandName: "",
    productUrl: "",
    brandDnaMarkdown: "",
    imagePromptModifier: "",
    model: "",
  })
  const [brandDraftSource, setBrandDraftSource] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) {
      setCreatedProduct(null)
      setProductLabel("")
      setProductUrl("")
      setActiveStep("product")
      setBrandDraft({
        brandName: "",
        productUrl: "",
        brandDnaMarkdown: "",
        imagePromptModifier: "",
        model: "",
      })
      setBrandDraftSource(null)
    }
  }, [open])

  const addProduct = useMutation(
    orpc.addProduct.mutationOptions({
      onSuccess: (product) => {
        setCreatedProduct(product)
        setActiveStep("claims")
      },
      onError: (error) =>
        toast.error(`Product onboarding failed: ${error.message}`),
    }),
  )

  const ingestionQuery = useQuery(
    orpc.getIngestionState.queryOptions({
      input: { productId: createdProduct?.id ?? "" },
      enabled: createdProduct != null,
      refetchInterval: (query) => {
        const status = query.state.data?.status
        return status === "completed" || status === "failed" ? false : 1500
      },
    }),
  )

  const claimsQuery = useQuery(
    orpc.listApprovedClaims.queryOptions({
      input: { productId: createdProduct?.id ?? "" },
      enabled: createdProduct != null,
      refetchInterval: activeStep === "claims" ? 1500 : false,
    }),
  )

  const brandIngestionQuery = useQuery(
    orpc.getBrandIngestionStateForProduct.queryOptions({
      input: { productId: createdProduct?.id ?? "" },
      enabled: createdProduct != null,
      refetchInterval: (query) => {
        const status = query.state.data?.status
        return status === "completed" || status === "failed" ? false : 1500
      },
    }),
  )

  const approveBrand = useMutation(
    orpc.approveBrandIngestion.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.listBrands.key() })
        queryClient.invalidateQueries({ queryKey: orpc.getBrandIngestionStateForProduct.key() })
        toast.success("Brand voice approved")
        onOpenChange(false)
      },
      onError: (error) =>
        toast.error(`Approving brand voice failed: ${error.message}`),
    }),
  )

  const claims = (claimsQuery.data ?? []) as ProductClaim[]
  const approvedCount = claims.filter((claim) => claim.status === "approved").length
  const ingestionStatus = ingestionQuery.data?.status ?? null
  const claimsProgress = progressForStatus(ingestionStatus, claims.length)
  const brandIngestionStatus = brandIngestionQuery.data?.status ?? null
  const brandSnapshot = parseBrandSnapshot(brandIngestionQuery.data?.content)

  React.useEffect(() => {
    if (!brandSnapshot || !brandIngestionQuery.data?.id) return
    if (brandDraftSource === brandIngestionQuery.data.id) return
    setBrandDraft({
      brandName: brandSnapshot.brandName ?? "",
      productUrl: brandSnapshot.productUrl ?? productUrl,
      brandDnaMarkdown: brandSnapshot.brandDnaMarkdown ?? "",
      imagePromptModifier: brandSnapshot.imagePromptModifier ?? "",
      model: brandSnapshot.model ?? "unknown",
    })
    setBrandDraftSource(brandIngestionQuery.data.id)
  }, [brandDraftSource, brandIngestionQuery.data?.id, brandSnapshot, productUrl])

  function startProductIngestion() {
    const name = productLabel.trim()
    const sourceUrl = productUrl.trim()
    if (!name || !sourceUrl) return

    addProduct.mutate({
      ...(activeBrandId ? { brandId: activeBrandId } : {}),
      name,
      sourceUrl,
    })
  }

  function approveBrandDraft() {
    if (!createdProduct || !brandDraft.brandName.trim()) return
    approveBrand.mutate({
      brandId: createdProduct.brandId,
      productId: createdProduct.id,
      brandName: brandDraft.brandName.trim(),
      productUrl: brandDraft.productUrl || productUrl,
      brandDnaMarkdown: brandDraft.brandDnaMarkdown.trim(),
      imagePromptModifier: brandDraft.imagePromptModifier.trim(),
      citations: normalizeCitations(brandSnapshot?.citations),
      model: brandDraft.model || brandSnapshot?.model || "unknown",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90svh] overflow-y-auto sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>Add a product</DialogTitle>
          <DialogDescription>
            Paste a product link and label. Empyris will generate proposed claims
            and prepare brand voice findings from the product.
          </DialogDescription>
        </DialogHeader>

        <Stepper activeStep={activeStep} />

        {activeStep === "product" ? (
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="product-url">Product link</Label>
              <Input
                id="product-url"
                type="url"
                placeholder="https://example.com/products/product"
                value={productUrl}
                onChange={(event) => setProductUrl(event.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="product-label">Product label</Label>
              <Input
                id="product-label"
                placeholder="Product name or label"
                value={productLabel}
                onChange={(event) => setProductLabel(event.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={addProduct.isPending || !productLabel.trim() || !productUrl.trim()}
                onClick={startProductIngestion}
              >
                {addProduct.isPending ? "Starting..." : "Start ingestion"}
              </Button>
            </div>
          </div>
        ) : null}

        {activeStep === "claims" && createdProduct ? (
          <div className="grid gap-5">
            <ProgressBlock
              label="Product claims ingestion"
              value={claimsProgress}
              status={labelForStatus(ingestionStatus, claims.length)}
            />

            {claims.length > 0 ? (
              <ProductClaimsList
                productId={createdProduct.id}
                claims={claims}
                showReviewActions
              />
            ) : (
              <Card size="sm">
                <CardContent className="py-6 text-sm text-muted-foreground">
                  Proposed claims will appear here when the ingestion job finishes.
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                disabled={approvedCount === 0}
                onClick={() => setActiveStep("brand")}
              >
                Continue to brand voice
              </Button>
            </div>
          </div>
        ) : null}

        {activeStep === "brand" && createdProduct ? (
          <div className="grid gap-5">
            <ProgressBlock
              label="Brand voice ingestion"
              value={progressForStatus(brandIngestionStatus, brandSnapshot ? 1 : 0)}
              status={labelForBrandStatus(brandIngestionStatus, Boolean(brandSnapshot))}
            />
            <BrandVoiceEditor
              documentKey={brandDraftSource ?? createdProduct.id}
              value={brandDraft}
              editable
              saving={approveBrand.isPending}
              saveLabel="Approve brand voice"
              onChange={setBrandDraft}
              onSave={approveBrandDraft}
            />
            <div className="flex justify-start">
              <Button type="button" variant="outline" onClick={() => setActiveStep("claims")}>
                Back
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Stepper({ activeStep }: { activeStep: StepId }) {
  const activeIndex = steps.findIndex((step) => step.id === activeStep)

  return (
    <div className="grid grid-cols-3 border text-xs uppercase tracking-wide">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={cn(
            "flex items-center gap-2 border-r px-3 py-2 last:border-r-0",
            index <= activeIndex ? "bg-muted/60 text-foreground" : "text-muted-foreground",
          )}
        >
          <span className="flex size-5 items-center justify-center border text-[10px]">
            {index + 1}
          </span>
          <span className="truncate">{step.label}</span>
        </div>
      ))}
    </div>
  )
}

function ProgressBlock({
  label,
  value,
  status,
}: {
  label: string
  value: number
  status: string
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}%</span>
      </div>
      <Progress value={value} />
      <div className="text-xs text-muted-foreground">{status}</div>
    </div>
  )
}

function progressForStatus(status: string | null, claimCount: number) {
  if (claimCount > 0 || status === "completed") return 100
  if (status === "running") return 70
  if (status === "pending") return 35
  if (status === "failed") return 100
  return 10
}

function labelForStatus(status: string | null, claimCount: number) {
  if (claimCount > 0 || status === "completed") return "Proposed claims are ready"
  if (status === "running") return "Generating proposed claims"
  if (status === "pending") return "Queued"
  if (status === "failed") return "The ingestion job failed"
  return "Starting"
}

function labelForBrandStatus(status: string | null, hasSnapshot: boolean) {
  if (hasSnapshot || status === "completed") return "Brand voice findings are ready"
  if (status === "running") return "Generating brand voice findings"
  if (status === "pending") return "Queued"
  if (status === "failed") return "The brand ingestion job failed"
  return "Starting"
}

function parseBrandSnapshot(content: string | null | undefined) {
  if (!content) return null
  try {
    const parsed = JSON.parse(content) as {
      brandName?: string
      productUrl?: string
      brandDnaMarkdown?: string
      imagePromptModifier?: string
      citations?: Array<{ url?: string; title?: string }>
      model?: string
    }
    return parsed.brandDnaMarkdown && parsed.imagePromptModifier ? parsed : null
  } catch {
    return null
  }
}

function normalizeCitations(citations: Array<{ url?: string; title?: string }> | undefined) {
  return (citations ?? [])
    .filter((citation): citation is { url: string; title?: string } => Boolean(citation.url))
    .map((citation) =>
      citation.title ? { url: citation.url, title: citation.title } : { url: citation.url },
    )
}

function brandNameFromUrl(value: string) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "")
    const [name] = host.split(".")
    return name ? name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null
  } catch {
    return null
  }
}
