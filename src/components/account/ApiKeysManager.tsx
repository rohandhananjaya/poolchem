"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Key, Copy, Check, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { UpgradeDialog } from "@/components/upgrade-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createApiKeyAction,
  revokeApiKeyAction,
} from "@/app/(dashboard)/account/api-keys/actions"

const MAX_NAME_LENGTH = 60

export interface ApiKeyRow {
  id: string
  name: string
  keyPrefix: string
  lastUsedAt: Date | string | null
  revokedAt: Date | string | null
  createdAt: Date | string
}

/**
 * Manages a company's API keys: generate (name → one-time secret reveal) and
 * revoke, gated behind the `api_access` plan feature. Mirrors the locked
 * dashed-border upsell idiom used by `ImportPoolsDialog`/`ProfileForms` when
 * the plan doesn't include the feature.
 */
export function ApiKeysManager({
  canUseApiKeys,
  keys,
}: {
  canUseApiKeys: boolean
  keys: ApiKeyRow[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = React.useTransition()
  const [name, setName] = React.useState("")
  const [revealedSecret, setRevealedSecret] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  function reset() {
    setName("")
    setRevealedSecret(null)
    setCopied(false)
  }

  function handleCreate() {
    startTransition(async () => {
      const res = await createApiKeyAction(name)
      if (!res.ok || !res.plaintextSecret) {
        toast.error(res.error ?? "Could not create the API key.")
        return
      }
      setRevealedSecret(res.plaintextSecret)
      router.refresh()
    })
  }

  function handleRevoke(keyId: string) {
    startTransition(async () => {
      const res = await revokeApiKeyAction(keyId)
      if (!res.ok) {
        toast.error(res.error ?? "Could not revoke the API key.")
        return
      }
      toast.success("API key revoked.")
      router.refresh()
    })
  }

  async function handleCopy() {
    if (!revealedSecret) return
    try {
      await navigator.clipboard.writeText(revealedSecret)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Copy this API key:", revealedSecret)
    }
  }

  if (!canUseApiKeys) {
    return <UpgradeDialog featureName="API access" buttonLabel="API keys" />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-md text-sm text-muted-foreground">
          Keys authenticate server-to-server requests to the Poolbench API —
          never embed one in browser-side code.
        </p>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next)
            if (!next) reset()
          }}
        >
          <DialogTrigger asChild>
            <Button type="button" size="lg" className="shrink-0">
              <Key />
              New key
            </Button>
          </DialogTrigger>
          <DialogContent>
            {revealedSecret ? (
              <>
                <DialogHeader>
                  <DialogTitle>Copy your new API key</DialogTitle>
                  <DialogDescription>
                    This is the only time you&apos;ll see the full key — store
                    it somewhere safe. You&apos;ll need to generate a new one
                    if you lose it.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
                  <code className="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
                    {revealedSecret}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="shrink-0"
                    onClick={handleCopy}
                  >
                    {copied ? <Check /> : <Copy />}
                  </Button>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      reset()
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>New API key</DialogTitle>
                  <DialogDescription>
                    Give it a name so you can tell it apart later (e.g.
                    &quot;Zapier integration&quot;).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-1.5">
                  <Label htmlFor="api-key-name">Name</Label>
                  <Input
                    id="api-key-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Zapier integration"
                    disabled={pending}
                    maxLength={MAX_NAME_LENGTH}
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCreate}
                    disabled={pending || !name.trim()}
                  >
                    {pending ? "Generating…" : "Generate key"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Key className="size-8" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">
            No API keys yet.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate one to start calling the Poolbench API.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {key.name}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {key.keyPrefix}…
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {key.revokedAt
                    ? `Revoked ${format(new Date(key.revokedAt), "MMM d, yyyy")}`
                    : key.lastUsedAt
                      ? `Last used ${format(new Date(key.lastUsedAt), "MMM d, yyyy")}`
                      : "Never used"}
                </p>
              </div>
              {!key.revokedAt && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-destructive"
                  disabled={pending}
                  onClick={() => handleRevoke(key.id)}
                >
                  <Trash2 />
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
