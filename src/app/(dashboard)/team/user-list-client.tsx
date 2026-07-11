"use client"

import * as React from "react"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EditUserDialog } from "./edit-user-dialog"
import { DeleteUserDialog } from "./delete-user-dialog"

export function UserListClient({
  user,
}: {
  user: { id: string; name: string; email: string; role: string; phone: string | null }
}) {
  const [editing, setEditing] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleting(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editing ? (
        <EditUserDialog
          user={user}
          open={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(false)
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteUserDialog
          user={user}
          open={deleting}
          onOpenChange={(open) => {
            if (!open) setDeleting(false)
          }}
        />
      ) : null}
    </>
  )
}
