import Link from "next/link"
import { ArrowLeft, MessageSquare } from "lucide-react"

import { requireSuperAdmin } from "@/lib/auth"
import { getAllFeedback, FEEDBACK_PAGE_SIZE } from "@/lib/db/feedback"
import { Shell } from "@/components/ui/shell"
import { Pagination } from "@/components/ui/pagination"
import { buildQueryString } from "@/lib/url"
import {
  FeedbackTypeBadge,
  formatFeedbackDate,
} from "@/components/feedback/feedback-badges"
import { FeedbackStatusSelect } from "@/components/feedback/FeedbackStatusSelect"
import type { FeedbackStatus, FeedbackType } from "@/generated/prisma/client"

export const dynamic = "force-dynamic"

const TYPE_FILTERS: { value: FeedbackType | ""; label: string }[] = [
  { value: "", label: "All types" },
  { value: "BUG_REPORT", label: "Bug reports" },
  { value: "FEATURE_REQUEST", label: "Feature requests" },
  { value: "ISSUE", label: "General issues" },
]

const STATUS_FILTERS: { value: FeedbackStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
]

export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; status?: string }>
}) {
  await requireSuperAdmin()

  const sp = await searchParams
  const currentPage = Math.max(1, Number(sp.page) || 1)
  const type = (sp.type ?? "") as FeedbackType | ""
  const status = (sp.status ?? "") as FeedbackStatus | ""

  const { feedback, total } = await getAllFeedback({
    page: currentPage,
    type: type || null,
    status: status || null,
  })

  const totalPages = Math.ceil(total / FEEDBACK_PAGE_SIZE)
  const buildHref = (page: number) =>
    `/admin/feedback?${buildQueryString(new URLSearchParams(), {
      page: String(page),
      type: type || undefined,
      status: status || undefined,
    })}`

  return (
    <Shell title="Feedback">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-muted"
              aria-label="Back to admin"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Feedback
            </h1>
          </div>
        </div>

        <form
          method="get"
          action="/admin/feedback"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Type
            </label>
            <select
              name="type"
              defaultValue={type}
              className="flex h-9 rounded-lg border border-input bg-background px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {TYPE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Status
            </label>
            <select
              name="status"
              defaultValue={status}
              className="flex h-9 rounded-lg border border-input bg-background px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Filter
          </button>
        </form>

        <div className="space-y-3">
          {feedback.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <FeedbackTypeBadge type={item.type} />
                <span className="text-xs text-muted-foreground">
                  {item.user.name} · {item.user.email}
                </span>
                {item.company ? (
                  <span className="text-xs text-muted-foreground">
                    · {item.company.name}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  · {formatFeedbackDate(item.createdAt)}
                </span>
                <span className="ml-auto">
                  <FeedbackStatusSelect
                    feedbackId={item.id}
                    currentStatus={item.status}
                  />
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

          {total === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MessageSquare className="size-8" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                No submissions match
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting the filters, or wait for users to report something.
              </p>
            </div>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          buildHref={buildHref}
          itemLabel="submission"
          total={total}
        />
      </div>
    </Shell>
  )
}
