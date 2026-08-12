"use client"

import { Button } from "@/components/ui/button"
import { EditPoolDialog } from "@/components/pools/EditPoolDialog"
import { DeletePoolDialog } from "@/components/pools/DeletePoolDialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"

interface PoolActionsProps {
  pool: {
    id: string
    name: string
    volume: number
    address: string | null
    homeownerEmail: string | null
    homeownerPhone: string | null
    notes: string | null
    propertyId: string | null
    isActive: boolean
  }
}

export function PoolActions({ pool }: PoolActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} asChild>
          <EditPoolDialog pool={pool} />
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} asChild>
          <DeletePoolDialog poolId={pool.id} poolName={pool.name} />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
