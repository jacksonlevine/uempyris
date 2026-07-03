"use client"

import * as React from "react"

import { NavMain } from "#/components/nav-main.tsx"
import { NavUser } from "#/components/nav-user.tsx"
import { BrandSwitcher } from "#/components/brand-switcher.tsx"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "#/components/ui/sidebar.tsx"
import { GalleryVerticalEndIcon, PackageIcon } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { orpc } from "#/orpc/client.ts"

// Matches the products table row (created_at as string via drizzle mode: 'string').
export type Product = {
  id: number
  brandId: number
  organizationId: string
  name: string
  createdAt: string
}

export function AppSidebar({
  user,
  signOut,
  onProductSelect,
  selectedProductId,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: any
  signOut: any
  onProductSelect: (product: Product | null) => void
  selectedProductId?: number
}) {
  const queryClient = useQueryClient()

  const brandsQuery = useQuery(orpc.listBrands.queryOptions())
  const brands = brandsQuery.data ?? []

  const [selectedBrandId, setSelectedBrandId] = React.useState<number | null>(null)
  // Fall back to the first brand until the user picks one.
  const activeBrandId = selectedBrandId ?? brands[0]?.id ?? null

  const productsQuery = useQuery(
    orpc.listProducts.queryOptions({
      input: { brandId: activeBrandId! },
      enabled: activeBrandId != null,
    }),
  )
  const productRows = productsQuery.data ?? []

  const addBrand = useMutation(
    orpc.addBrand.mutationOptions({
      onSuccess: (brand) => {
        queryClient.invalidateQueries({ queryKey: orpc.listBrands.key() })
        setSelectedBrandId(brand.id)
        onProductSelect(null)
      },
    }),
  )

  const addProduct = useMutation(
    orpc.addProduct.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: orpc.listProducts.key() }),
    }),
  )

  const navMain = [
    {
      title: "Products",
      url: "#",
      icon: (
        <PackageIcon
        />
      ),
      isActive: true,
      items: [
        ...productRows.map((product) => ({
          title: product.name,
          url: "#",
          isActive: product.id === selectedProductId,
          onClick: (event: React.MouseEvent) => {
            event.preventDefault()
            onProductSelect(product)
          },
        })),
        {
          title: "+ Add product",
          url: "#",
          onClick: (event: React.MouseEvent) => {
            event.preventDefault()
            if (activeBrandId == null) return
            const name = window.prompt("Product name")
            if (name) addProduct.mutate({ brandId: activeBrandId, name })
          },
        },
      ],
    },
  ]

  return (
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
          }}
          onAdd={() => {
            const name = window.prompt("Brand name")
            if (name) addBrand.mutate({ name })
          }}
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
  )
}
