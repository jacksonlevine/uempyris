"use client"

import * as React from "react"

import { NavMain } from "#/components/nav-main.tsx"
import { NavUser } from "#/components/nav-user.tsx"
import { BrandSwitcher } from "#/components/brand-switcher.tsx"
import { ProductOnboardingDialog } from "#/components/product-onboarding-dialog.tsx"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "#/components/ui/sidebar.tsx"
import { GalleryVerticalEndIcon, LayoutDashboardIcon, MicVocalIcon, PackageIcon } from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { orpc } from "#/orpc/client.ts"

// Matches John's ProductSchema from empyris-monorepo.
export type Product = {
  id: string
  brandId: string
  name: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type Brand = {
  id: string
  name: string
  orgId: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type MainView = "overview" | "brandVoice" | "products"

export function AppSidebar({
  user,
  signOut,
  onProductSelect,
  onViewSelect,
  onActiveBrandChange,
  onProductsChange,
  activeView,
  selectedProductId,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: any
  signOut: any
  onProductSelect: (product: Product | null) => void
  onViewSelect: (view: MainView) => void
  onActiveBrandChange?: (brand: Brand | null) => void
  onProductsChange?: (products: Product[]) => void
  activeView: MainView
  selectedProductId?: string
}) {
  const queryClient = useQueryClient()

  const brandsQuery = useQuery(orpc.listBrands.queryOptions())
  const brands = brandsQuery.data ?? []

  const [selectedBrandId, setSelectedBrandId] = React.useState<string | null>(null)
  // Fall back to the first brand until the user picks one.
  const activeBrandId = selectedBrandId ?? brands[0]?.id ?? null
  const activeBrand = brands.find((brand) => brand.id === activeBrandId) ?? null

  const productsQuery = useQuery(
    orpc.listProducts.queryOptions({
      input: { brandId: activeBrandId! },
      enabled: activeBrandId != null,
    }),
  )
  const productRows = React.useMemo(
    () => productsQuery.data ?? [],
    [productsQuery.data],
  )

  React.useEffect(() => {
    if (selectedProductId == null) return
    const selected = productRows.find((product) => product.id === selectedProductId)
    if (selected) onProductSelect(selected)
  }, [onProductSelect, productRows, selectedProductId])

  React.useEffect(() => {
    onProductsChange?.(productRows)
  }, [onProductsChange, productRows])

  React.useEffect(() => {
    onActiveBrandChange?.((activeBrand as Brand | null) ?? null)
  }, [activeBrand, onActiveBrandChange])

  const [dialogOpen, setDialogOpen] = React.useState(false)

  const navMain = [
    {
      title: "Overview",
      url: "#",
      icon: <LayoutDashboardIcon />,
      isActive: activeView === "overview" && !selectedProductId,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        onProductSelect(null)
        onViewSelect("overview")
      },
    },
    {
      title: "Brand Voice",
      url: "#",
      icon: <MicVocalIcon />,
      isActive: activeView === "brandVoice" && !selectedProductId,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        onProductSelect(null)
        onViewSelect("brandVoice")
      },
    },
    {
      title: "Products",
      url: "#",
      icon: (
        <PackageIcon
        />
      ),
      isActive: activeView === "products" || selectedProductId != null,
      forceOpen: true,
      onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        onProductSelect(null)
        onViewSelect("products")
      },
      items: [
        ...productRows.map((product) => ({
          id: product.id,
          title: product.name,
          url: "#",
          isActive: product.id === selectedProductId,
          onClick: (event: React.MouseEvent) => {
            event.preventDefault()
            onProductSelect(product)
            onViewSelect("products")
          },
        })),
        {
          title: "+ Add product",
          url: "#",
          onClick: (event: React.MouseEvent) => {
            event.preventDefault()
            setDialogOpen(true)
          },
        },
      ],
    },
  ]

  return (
    <>
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <BrandSwitcher
          brands={brands.map((brand) => ({
            id: brand.id,
            name: brand.name,
            logo: <GalleryVerticalEndIcon />,
          }))}
          activeBrandId={activeBrandId}
          onSelect={(id) => {
            setSelectedBrandId(id)
            onProductSelect(null)
            onViewSelect("overview")
          }}
          onAdd={() => setDialogOpen(true)}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} signOut={signOut}/>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>

    <ProductOnboardingDialog
      open={dialogOpen}
      activeBrandId={activeBrandId}
      onOpenChange={setDialogOpen}
      onProductCreated={(product) => {
        setSelectedBrandId(product.brandId)
        onProductSelect(product)
        onViewSelect("products")
        queryClient.invalidateQueries({ queryKey: orpc.listBrands.key() })
        queryClient.invalidateQueries({ queryKey: orpc.listProducts.key() })
      }}
    />
    </>
  )
}
