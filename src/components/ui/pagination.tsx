import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { generatePageNumbers } from "@/lib/url"
import { Button } from "@/components/ui/button"

interface PaginationProps {
  currentPage: number
  totalPages: number
  buildHref: (page: number) => string
  itemLabel: string
  total: number
}

export function Pagination({
  currentPage,
  totalPages,
  buildHref,
  itemLabel,
  total,
}: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <>
      <div className="mt-6 flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          asChild={currentPage > 1}
        >
          {currentPage > 1 ? (
            <Link href={buildHref(currentPage - 1)}>
              <ChevronLeft className="size-4" />
              Prev
            </Link>
          ) : (
            <>
              <ChevronLeft className="size-4" />
              Prev
            </>
          )}
        </Button>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          {generatePageNumbers(currentPage, totalPages).map(
            (item, i) =>
              item === "..." ? (
                <span key={`ellipsis-${i}`} className="px-1">
                  ...
                </span>
              ) : (
                <Link
                  key={item}
                  href={buildHref(item)}
                  className={`inline-flex size-8 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                    item === currentPage
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {item}
                </Link>
              ),
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          asChild={currentPage < totalPages}
        >
          {currentPage < totalPages ? (
            <Link href={buildHref(currentPage + 1)}>
              Next
              <ChevronRight className="size-4" />
            </Link>
          ) : (
            <>
              Next
              <ChevronRight className="size-4" />
            </>
          )}
        </Button>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        Page {currentPage} of {totalPages} ({total} {itemLabel}
        {total !== 1 ? "s" : ""})
      </p>
    </>
  )
}
