import { notFound } from "next/navigation"
import Link from "next/link"
import { Waves } from "lucide-react"

import { getValidInvitation } from "@/lib/db/invitations"
import { AcceptInviteForm } from "./accept-invite-form"

export const dynamic = "force-dynamic"

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invitation = await getValidInvitation(token)

  if (!invitation) {
    notFound()
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1.5 text-center">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight mb-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
              <Waves className="size-5" />
            </span>
            <span className="text-lg">Poolbench</span>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Join {invitation.company.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            You&lsquo;ve been invited as a{invitation.role === "OWNER" ? "n " : " "}
            {invitation.role === "OWNER" ? "owner" : "technician"}.
            Set your password to get started.
          </p>
        </div>

        <AcceptInviteForm
          token={token}
          name={invitation.name}
          email={invitation.email}
        />
      </div>
    </div>
  )
}
