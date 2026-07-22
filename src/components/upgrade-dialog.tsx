"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface UpgradeDialogProps {
  featureName: string
  buttonLabel: string
  planUrl?: string
}

export function UpgradeDialog({
  featureName,
  buttonLabel,
  planUrl = "/account/package",
}: UpgradeDialogProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="lg">
          <Lock />
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{featureName}</DialogTitle>
          <DialogDescription>
            {featureName} is available on paid plans.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => router.push(planUrl)}
          >
            See plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
