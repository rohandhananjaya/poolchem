"use client"

import { MapPin } from "lucide-react"

import { CardRow } from "@/components/ui/card-row"
import { PropertyActions } from "./PropertyActions"
import { PropertyPoolsManager } from "./PropertyPoolsManager"

interface PropertyRowProps {
  property: {
    id: string
    name: string
    address: string | null
    notes: string | null
  }
  /** Pools attached to this property. */
  pools: { id: string; name: string }[]
  /** The company's ungrouped pools (eligible to be added). */
  ungroupedPools: { id: string; name: string }[]
  /** The company's properties, for the Location select on a new pool. */
  properties: { id: string; name: string }[]
}

export function PropertyRow({
  property,
  pools,
  ungroupedPools,
  properties,
}: PropertyRowProps) {
  return (
    <div className="space-y-2">
      <CardRow actions={<PropertyActions property={property} />}>
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-semibold text-card-foreground">
            {property.name}
          </h3>
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            <span className="font-mono tabular-nums">{pools.length}</span>{" "}
            pool{pools.length !== 1 ? "s" : ""}
          </span>
        </div>

        {property.address ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{property.address}</span>
          </p>
        ) : null}
      </CardRow>

      <PropertyPoolsManager
        propertyId={property.id}
        pools={pools}
        ungroupedPools={ungroupedPools}
        properties={properties}
      />
    </div>
  )
}
