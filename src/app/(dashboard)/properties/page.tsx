import { redirect } from "next/navigation"
import { Building2 } from "lucide-react"

import { requireOwner } from "@/lib/auth"
import { getPropertiesByCompany } from "@/lib/db/properties"
import { getPoolsByCompany } from "@/lib/db/pools"
import { Shell } from "@/components/ui/shell"
import { EmptyState } from "@/components/ui/empty-state"
import { AddPropertyDialog } from "@/components/properties/AddPropertyDialog"
import { PropertyRow } from "@/components/properties/PropertyRow"

export const dynamic = "force-dynamic"

export default async function PropertiesPage() {
  const user = await requireOwner()
  if (!user.companyId) {
    redirect("/admin")
  }

  const [properties, pools] = await Promise.all([
    getPropertiesByCompany(user.companyId),
    getPoolsByCompany(user.companyId),
  ])

  const ungroupedPools = pools
    .filter((pool) => !pool.propertyId)
    .map((pool) => ({ id: pool.id, name: pool.name }))

  const propertyOptions = properties.map((property) => ({
    id: property.id,
    name: property.name,
  }))

  return (
    <Shell title="Properties">
      <div className="space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Group pools that share one location under a property.
            </p>
          </div>
          <AddPropertyDialog />
        </header>

        {properties.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-8" />}
            title="No properties yet."
            description="Create a property to group multiple pools that share one location."
          />
        ) : (
          <div className="space-y-4">
            {properties.map((property) => (
              <PropertyRow
                key={property.id}
                property={{
                  id: property.id,
                  name: property.name,
                  address: property.address,
                  notes: property.notes,
                }}
                pools={property.pools.map((pool) => ({
                  id: pool.id,
                  name: pool.name,
                }))}
                ungroupedPools={ungroupedPools}
                properties={propertyOptions}
              />
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
