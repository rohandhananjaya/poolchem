import { requireAuth } from "@/lib/auth"
import { getFeedbackByUser } from "@/lib/db/feedback"
import { Shell } from "@/components/ui/shell"
import { FeedbackForm } from "@/components/feedback/FeedbackForm"
import { FeedbackList } from "@/components/feedback/FeedbackList"

export const dynamic = "force-dynamic"

export default async function FeedbackPage() {
  const user = await requireAuth()
  const submissions = await getFeedbackByUser(user.id, user.companyId ?? null)

  return (
    <Shell title="Feedback">
      <div className="space-y-6">
        <FeedbackForm />
        <FeedbackList submissions={submissions} />
      </div>
    </Shell>
  )
}
