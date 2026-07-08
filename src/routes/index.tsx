import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Page })

import * as React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import type { Brand, MainView, Product } from "@/components/app-sidebar"
import {
  BrandVoiceEditor,
  type BrandVoiceDraft,
} from "@/components/brand-voice-editor"
import { ProductOnboardingDialog } from "@/components/product-onboarding-dialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

import { useAuth } from "@workos/authkit-tanstack-react-start/client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { orpc } from "#/orpc/client.ts"

function LoginPage() {
  return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
        <div className="w-full max-w-sm md:max-w-3xl">
          <Card className="overflow-hidden p-0">
            <CardContent className="grid p-0 md:grid-cols-2">
              <div className="flex flex-col items-center justify-center gap-6 p-8 text-center md:p-10">
                <img
                    src="/logo.svg"
                    alt="Empyris emblem"
                    className="size-28 rounded-full bg-[#FAF7F2] md:hidden"
                />
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Empyris
                  </h1>
                  <p className="text-balance text-muted-foreground">
                    Sign in to your account to continue
                  </p>
                </div>
                <Button className="w-full" asChild>
                  <a href="/api/auth/sign-in">Sign In</a>
                </Button>
                <p className="text-balance text-center text-xs text-muted-foreground">
                  By signing in, you agree to our{" "}
                  <a href="#" className="underline underline-offset-4 hover:text-primary">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="underline underline-offset-4 hover:text-primary">
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>
              <div className="hidden items-center justify-center bg-[#FAF7F2] p-8 md:flex">
                <img
                    src="/logo.svg"
                    alt=""
                    className="w-full max-w-[280px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}

function ProductDetail({ product }: { product: Product }) {
  const rows: [string, string | null][] = [
    ["id", product.id],
    ["brand_id", product.brandId],
    ["created_by", product.createdBy],
    ["created_at", product.createdAt],
    ["updated_at", product.updatedAt],
  ]

  return (
    <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{product.name}</CardTitle>
          <CardDescription>Product</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            {rows.map(([column, value]) => (
              <div
                key={column}
                className="grid grid-cols-[140px_1fr] border-b text-sm last:border-b-0"
              >
                <div className="border-r bg-muted/50 px-3 py-2 font-mono text-muted-foreground">
                  {column}
                </div>
                <div className="whitespace-pre-wrap px-3 py-2">
                  {value || "-"}
                </div>
              </div>
              ))}
          </div>
        </CardContent>
    </Card>
  )
}

function ProductsOverview({
  products,
  onProductSelect,
}: {
  products: Product[]
  onProductSelect: (product: Product) => void
}) {
  if (products.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Add a product to get started. Empyris will use the product link to generate claims and prepare brand voice findings.
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <Card
          key={product.id}
          className="cursor-pointer transition-colors hover:bg-muted/30"
          role="button"
          tabIndex={0}
          onClick={() => onProductSelect(product)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onProductSelect(product)
            }
          }}
        >
          <img
            src={product.primaryImageUrl ?? "/productimage.png"}
            alt=""
            className="aspect-video w-full object-cover"
            onError={(event) => {
              event.currentTarget.src = "/productimage.png"
            }}
          />
          <CardHeader>
            <CardTitle className="truncate">{product.name}</CardTitle>
            <CardDescription>{formatDate(product.createdAt)}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

function OverviewSections({
  brand,
  products,
  onSectionSelect,
}: {
  brand: Brand | null
  products: Product[]
  onSectionSelect: (view: MainView) => void
}) {
  return (
    <div className="grid gap-3">
      <SectionBar
        title="Brand Voice"
        detail={brand ? `Voice and identity for ${brand.name}` : "Add a product to get started"}
        onClick={() => onSectionSelect("brandVoice")}
      />
      <SectionBar
        title="Products"
        detail={`${products.length} product${products.length === 1 ? "" : "s"}`}
        onClick={() => onSectionSelect("products")}
      />
    </div>
  )
}

function SectionBar({
  title,
  detail,
  onClick,
}: {
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-4 border bg-card/70 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      onClick={onClick}
    >
      <span className="font-heading text-lg font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{detail}</span>
    </button>
  )
}

function BrandVoicePage({ brand }: { brand: Brand | null }) {
  const queryClient = useQueryClient()
  const [editable, setEditable] = React.useState(false)
  const [draft, setDraft] = React.useState<BrandVoiceDraft>({
    brandName: "",
    productUrl: "",
    brandDnaMarkdown: "",
    imagePromptModifier: "",
    model: "",
  })
  const [draftSource, setDraftSource] = React.useState<string | null>(null)

  const brandVoiceQuery = useQuery(
    orpc.getBrandVoice.queryOptions({
      input: { brandId: brand?.id ?? "" },
      enabled: brand != null,
    }),
  )

  const brandVoice = brandVoiceQuery.data

  React.useEffect(() => {
    if (!brandVoice) return
    const source = `${brandVoice.brandId}:${brandVoice.updatedAt}`
    if (draftSource === source) return
    setDraft({
      brandName: brandVoice.brandName ?? "",
      productUrl: brandVoice.productUrl ?? "",
      brandDnaMarkdown: brandVoice.brandDnaMarkdown ?? "",
      imagePromptModifier: brandVoice.imagePromptModifier ?? "",
      model: brandVoice.model ?? "",
    })
    setDraftSource(source)
    setEditable(false)
  }, [brandVoice, draftSource])

  const updateBrandVoice = useMutation(
    orpc.updateBrandVoice.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.getBrandVoice.key() })
        queryClient.invalidateQueries({ queryKey: orpc.listBrands.key() })
        setEditable(false)
        toast.success("Brand voice saved")
      },
      onError: (error) => toast.error(`Saving brand voice failed: ${error.message}`),
    }),
  )

  if (!brand) {
    return (
      <div className="text-sm text-muted-foreground">
        Add a product to get started.
      </div>
    )
  }

  if (brandVoiceQuery.isLoading) {
    return <Spinner className="size-6" />
  }

  return (
    <BrandVoiceEditor
      documentKey={draftSource ?? brand.id}
      value={draft}
      editable={editable}
      showModeToggle
      saving={updateBrandVoice.isPending}
      onEditableChange={setEditable}
      onChange={setDraft}
      onCancel={() => {
        if (!brandVoice) return
        setDraft({
          brandName: brandVoice.brandName ?? "",
          productUrl: brandVoice.productUrl ?? "",
          brandDnaMarkdown: brandVoice.brandDnaMarkdown ?? "",
          imagePromptModifier: brandVoice.imagePromptModifier ?? "",
          model: brandVoice.model ?? "",
        })
      }}
      onSave={() =>
        updateBrandVoice.mutate({
          brandId: brand.id,
          brandName: draft.brandName.trim(),
          productUrl: draft.productUrl,
          brandDnaMarkdown: draft.brandDnaMarkdown.trim(),
          imagePromptModifier: draft.imagePromptModifier.trim(),
          citations: brandVoice?.citations ?? [],
          model: draft.model || brandVoice?.model || "manual",
        })
      }
    />
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

export default function Page() {
  const { user, loading, signOut } = useAuth()
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)
  const [activeView, setActiveView] = React.useState<MainView>("overview")
  const [activeBrand, setActiveBrand] = React.useState<Brand | null>(null)
  const [products, setProducts] = React.useState<Product[]>([])
  const [productDialogOpen, setProductDialogOpen] = React.useState(false)

  if (loading) {
    return (
        <div className="flex min-h-svh items-center justify-center">
          <Spinner className="size-8" />
        </div>
    )
  }
  if (!user) return <LoginPage />

  return (
      <SidebarProvider>
        <AppSidebar user={{
          name: [user.firstName, user.lastName].filter(Boolean).join(' '),
          email: user.email,
          avatar: user.profilePictureUrl,
        }}
                    signOut={signOut}
                    onProductSelect={setSelectedProduct}
                    onViewSelect={setActiveView}
                    onActiveBrandChange={setActiveBrand}
                    onProductsChange={setProducts}
                    onAddProduct={() => setProductDialogOpen(true)}
                    activeView={activeView}
                    selectedProductId={selectedProduct?.id}
        />
        <ProductOnboardingDialog
          open={productDialogOpen}
          activeBrandId={activeBrand?.id ?? null}
          onOpenChange={setProductDialogOpen}
        />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator
                  orientation="vertical"
                  className="mr-2 data-[orientation=vertical]:h-4"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink
                      href="#"
                      onClick={(event) => {
                        event.preventDefault()
                        setSelectedProduct(null)
                        setActiveView("overview")
                      }}
                    >
                      Overview
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {activeView !== "overview" || selectedProduct ? (
                    <>
                      <BreadcrumbSeparator className="hidden md:block" />
                      <BreadcrumbItem>
                        {selectedProduct ? (
                          <BreadcrumbLink
                            href="#"
                            onClick={(event) => {
                              event.preventDefault()
                              setSelectedProduct(null)
                              setActiveView("products")
                            }}
                          >
                            Products
                          </BreadcrumbLink>
                        ) : (
                          <BreadcrumbPage>
                            {activeView === "brandVoice" ? "Brand Voice" : "Products"}
                          </BreadcrumbPage>
                        )}
                      </BreadcrumbItem>
                    </>
                  ) : null}
                  {selectedProduct ? (
                    <>
                      <BreadcrumbSeparator className="hidden md:block" />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{selectedProduct.name}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  ) : null}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {selectedProduct ? (
                <ProductDetail product={selectedProduct} />
            ) : activeView === "products" ? (
                <ProductsOverview
                  products={products}
                  onProductSelect={setSelectedProduct}
                />
            ) : activeView === "brandVoice" ? (
                <BrandVoicePage brand={activeBrand} />
            ) : (
                <OverviewSections
                  brand={activeBrand}
                  products={products}
                  onSectionSelect={setActiveView}
                />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
  )
}
