"use client"

import * as React from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { downloadPostmanCollectionAction } from "@/app/(dashboard)/account/api-keys/actions"

/**
 * Downloads a Postman collection (v2.1 JSON) pre-wired to the `/api/v1` REST
 * API, with the app's own base URL injected and `{{apiKey}}` ready to fill in.
 * Rendered only inside `ApiKeysManager`, which already gates the page behind
 * the `api_access` plan feature.
 */
export function DownloadPostmanButton() {
  const [pending, startTransition] = React.useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className="shrink-0"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await downloadPostmanCollectionAction()
          if (!result.ok || !result.collection) {
            toast.error(result.error ?? "Could not download the Postman collection.")
            return
          }
          const blob = new Blob([result.collection], {
            type: "application/json;charset=utf-8;",
          })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = "poolbench-api.postman_collection.json"
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
          toast.success("Postman collection downloaded.")
        })
      }
    >
      <Download />
      {pending ? "Preparing…" : "Postman collection"}
    </Button>
  )
}
