"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { CancelInvitationDialog } from "./cancel-invitation-dialog"

export function InvitationRowActions({
  invitation,
}: {
  invitation: { id: string; name: string; email: string }
}) {
  const [cancelling, setCancelling] = React.useState(false)

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8"
        onClick={() => setCancelling(true)}
      >
        <X className="size-4" />
        <span className="sr-only">Cancel invitation</span>
      </Button>

      {cancelling ? (
        <CancelInvitationDialog
          invitation={invitation}
          open={cancelling}
          onOpenChange={(open) => {
            if (!open) setCancelling(false)
          }}
        />
      ) : null}
    </>
  )
}
