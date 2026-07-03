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

import { useAuth } from "@workos-inc/authkit-react"
import { registerTokenGetter } from "#/orpc/client.ts"

function LoginPage() {
  const { signIn, isLoading } = useAuth()
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
                <Button
                    className="w-full"
                    onClick={() => signIn()}
                    disabled={isLoading}
                >
                  Sign In
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
  const row: [string, string | number][] = [
    ["id", product.id],
    ["brand_id", product.brandId],
    ["organization_id", product.organizationId],
    ["name", product.name],
    ["created_at", product.createdAt],
  ]
  return (
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{product.name}</CardTitle>
          <CardDescription>
            <code>products</code> table row
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            {row.map(([column, value]) => (
                <div
                    key={column}
                    className="grid grid-cols-[160px_1fr] border-b text-sm last:border-b-0"
                >
                  <div className="border-r bg-muted/50 px-3 py-2 font-mono text-muted-foreground">
                    {column}
                  </div>
                  <div className="px-3 py-2 font-mono">{value}</div>
                </div>
            ))}
          </div>
        </CardContent>
      </Card>
  )
}

export default function Page() {
  const { user, isLoading, signOut, getAccessToken } = useAuth()
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)

  // Render-time (not effect) so it's registered before child components'
  // queries fire — child effects run before parent effects.
  registerTokenGetter(getAccessToken)

  if (isLoading) {
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
                    <BreadcrumbLink href="#">
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
                <>
                  <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                    <div className="aspect-video rounded-xl bg-muted/50" />
                    <div className="aspect-video rounded-xl bg-muted/50" />
                    <div className="aspect-video rounded-xl bg-muted/50" />
                  </div>
                  <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
                </>
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
  )
}
