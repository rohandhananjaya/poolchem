"use client"

import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EditPropertyDialog } from "./EditPropertyDialog"
import { DeletePropertyDialog } from "./DeletePropertyDialog"

interface PropertyActionsProps {
  property: {
    id: string
    name: string
    address: string | null
    notes: string | null
  }
}

export function PropertyActions({ property }: PropertyActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} asChild>
          <EditPropertyDialog property={property} />
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()} asChild>
          <DeletePropertyDialog
            propertyId={property.id}
            propertyName={property.name}
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
