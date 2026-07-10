import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { requireSuperAdmin } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Shell } from "@/components/ui/shell"

export const dynamic = "force-dynamic"

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Platform Administrator",
  OWNER: "Owner",
  TECH: "Technician",
}

export default async function AdminUsersPage() {
  await requireSuperAdmin()

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { company: true },
  })

  return (
    <Shell title="Users">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
            aria-label="Back to admin"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Users
          </h1>
        </div>

        <div className="space-y-3">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {user.company ? user.company.name : "No company (platform admin)"}
              </p>
            </div>
          ))}

          {users.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No users yet.
            </p>
          )}
        </div>
      </div>
    </Shell>
  )
}
