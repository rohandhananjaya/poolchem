import { redirect } from "next/navigation"
import { Mail, Shield, UserCog } from "lucide-react"

import { requireOwner } from "@/lib/auth"
import { getUsersByCompany } from "@/lib/db/users"
import { Shell } from "@/components/ui/shell"
import type { UserRole } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  TECH: "Technician",
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default async function TeamPage() {
  const user = await requireOwner()
  if (!user.companyId) {
    redirect("/admin")
  }

  const users = await getUsersByCompany(user.companyId)

  return (
    <Shell title="Team">
      <div className="space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Team
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {users.length} user{users.length !== 1 ? "s" : ""} in your company
            </p>
          </div>
        </header>

        <div className="space-y-3">
          {users.map((member) => (
            <div
              key={member.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                    {initials(member.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {member.name}
                      {member.id === user.id ? (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      ) : null}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="size-3" />
                      {member.email}
                    </p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Shield className="size-3" />
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  )
}
