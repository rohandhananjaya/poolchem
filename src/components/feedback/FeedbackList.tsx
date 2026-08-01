import { MessageSquare } from "lucide-react"

import type { Feedback } from "@/generated/prisma/client"
import {
  FeedbackStatusBadge,
  FeedbackTypeBadge,
  formatFeedbackDate,
} from "@/components/feedback/feedback-badges"

export function FeedbackList({
  submissions,
}: {
  submissions: Feedback[]
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-foreground">
        Your submissions
      </h2>

      {submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MessageSquare className="size-8" />
          </div>
          <p className="mt-4 text-sm font-medium text-foreground">
            Nothing here yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reports you submit will show up here with their current status.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <FeedbackTypeBadge type={item.type} />
                <FeedbackStatusBadge status={item.status} />
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatFeedbackDate(item.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">
                {item.title}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
