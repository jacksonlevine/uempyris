import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Page })

import * as React from "react"

import { AppSidebar } from "@/components/app-sidebar"
import type { Product } from "@/components/app-sidebar"
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
        Add a product from the sidebar. Products in the active brand will appear here.
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
            src="/productimage.png"
            alt=""
            className="aspect-video w-full object-cover"
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
  const [products, setProducts] = React.useState<Product[]>([])

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
                    onProductsChange={setProducts}
                    selectedProductId={selectedProduct?.id}
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
                      }}
                    >
                      Products
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {selectedProduct ? selectedProduct.name : "Overview"}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {selectedProduct ? (
                <ProductDetail product={selectedProduct} />
            ) : (
                <ProductsOverview
                  products={products}
                  onProductSelect={setSelectedProduct}
                />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
  )
}
