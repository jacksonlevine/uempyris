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
import { toast } from "sonner"

import { Button } from "#/components/ui/button.tsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog.tsx"
import { Input } from "#/components/ui/input.tsx"
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

export function AppSidebar({
  user,
  signOut,
  onProductSelect,
  onProductsChange,
  selectedProductId,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: any
  signOut: any
  onProductSelect: (product: Product | null) => void
  onProductsChange?: (products: Product[]) => void
  selectedProductId?: string
}) {
  const queryClient = useQueryClient()

  const brandsQuery = useQuery(orpc.listBrands.queryOptions())
  const brands = brandsQuery.data ?? []

  const [selectedBrandId, setSelectedBrandId] = React.useState<string | null>(null)
  // Fall back to the first brand until the user picks one.
  const activeBrandId = selectedBrandId ?? brands[0]?.id ?? null

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

  // Dialog type is sticky (never cleared on close) so the content stays
  // stable through Radix's fade-out; only `dialogOpen` flips. Draft resets
  // at open, not close, for the same reason.
  const [dialogType, setDialogType] = React.useState<"brand" | "product">("brand")
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [draftName, setDraftName] = React.useState("")

  const openDialog = (type: "brand" | "product") => {
    setDialogType(type)
    setDraftName("")
    setDialogOpen(true)
  }
  const closeDialog = () => setDialogOpen(false)

  const addBrand = useMutation(
    orpc.addBrand.mutationOptions({
      onSuccess: (brand) => {
        queryClient.invalidateQueries({ queryKey: orpc.listBrands.key() })
        setSelectedBrandId(brand.id)
        onProductSelect(null)
        closeDialog()
      },
      onError: (error) => toast.error(`Adding brand failed: ${error.message}`),
    }),
  )

  const addProduct = useMutation(
    orpc.addProduct.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.listProducts.key() })
        closeDialog()
      },
      onError: (error) =>
        toast.error(`Adding product failed: ${error.message}`),
    }),
  )

  const addPending = addBrand.isPending || addProduct.isPending

  function submitAdd(event: React.FormEvent) {
    event.preventDefault()
    const name = draftName.trim()
    if (dialogType === "brand") {
      if (!name) return
      addBrand.mutate({ name })
      return
    }
    if (activeBrandId == null || !name) {
      return
    }
    addProduct.mutate({
      brandId: activeBrandId,
      name,
    })
  }

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
          id: product.id,
          title: product.name,
          url: "#",
          isActive: product.id === selectedProductId,
          onClick: (event: React.MouseEvent) => {
            event.preventDefault()
            onProductSelect(product)
          },
        })),
        // No brand → no possible product; hide the action instead of failing.
        ...(activeBrandId != null
          ? [
              {
                title: "+ Add product",
                url: "#",
                onClick: (event: React.MouseEvent) => {
                  event.preventDefault()
                  openDialog("product")
                },
              },
            ]
          : []),
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
          }}
          onAdd={() => openDialog("brand")}
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

    <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent
        className="sm:max-w-sm"
      >
        <form onSubmit={submitAdd}>
          <DialogHeader>
            <DialogTitle>
              {dialogType === "brand" ? "Add brand" : "Add product"}
            </DialogTitle>
            {dialogType === "product" ? (
              <DialogDescription>
                Create a product under the active brand.
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <Input
            className="my-4"
            placeholder={dialogType === "brand" ? "Brand name" : "Product name"}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button type="submit" disabled={addPending || !draftName.trim()}>
              {addPending ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
