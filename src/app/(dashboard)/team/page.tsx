import { redirect } from "next/navigation"
import { Mail, Phone, Shield, Clock } from "lucide-react"

import type { User, Invitation } from "@/generated/prisma/client"
import { initials } from "@/lib/utils"
import { requireOwner } from "@/lib/auth"
import { getUsersByCompany } from "@/lib/db/users"
import { getInvitationsByCompany } from "@/lib/db/invitations"
import { Shell } from "@/components/ui/shell"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { CreateUserDialog } from "./create-user-dialog"
import { InviteUserDialog } from "./invite-user-dialog"
import { UserListClient } from "./user-list-client"
import { InvitationRowActions } from "./invitation-row-actions"

export const dynamic = "force-dynamic"

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  TECH: "Technician",
}

export default async function TeamPage() {
  const user = await requireOwner()
  if (!user.companyId) {
    redirect("/admin")
  }

  const [users, invitations]: [User[], Invitation[]] = await Promise.all([
    getUsersByCompany(user.companyId),
    getInvitationsByCompany(user.companyId),
  ])

  return (
    <Shell title="Team">
      <div className="space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {users.length} user{users.length !== 1 ? "s" : ""} in your company
            </p>
          </div>
          <div className="flex items-center gap-2">
            <InviteUserDialog />
            <CreateUserDialog />
          </div>
        </header>

        {invitations.length > 0 ? (
          <section>
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pending invitations ({invitations.length})
            </h2>
            <div className="space-y-2">
              {invitations.map((inv: Invitation) => (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-4 py-3"
                >
                  <Clock className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {inv.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {inv.email}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {ROLE_LABELS[inv.role] ?? inv.role}
                  </span>
                  <InvitationRowActions
                    invitation={{ id: inv.id, name: inv.name, email: inv.email }}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Team members
          </h2>
          <div className="space-y-3">
            {users.map((member) => (
            <div
              key={member.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="size-10">
                    <AvatarFallback>{initials(member.name)}</AvatarFallback>
                  </Avatar>
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
                      <Mail className="size-3 shrink-0" />
                      {member.email}
                    </p>
                    {member.phone ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="size-3 shrink-0" />
                        {member.phone}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Shield className="size-3" />
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                  {member.id !== user.id ? (
                    <div className="contents">
                      <UserListClient
                        user={{
                          id: member.id,
                          name: member.name,
                          email: member.email,
                          role: member.role,
                          phone: member.phone,
                        }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
        </section>
      </div>
    </Shell>
  )
}


