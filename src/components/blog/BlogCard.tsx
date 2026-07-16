import Link from "next/link"
import { ChevronRight } from "lucide-react"

import type { BlogPost } from "@/lib/blog"
import {
  Card,
  CardContent,
} from "@/components/ui/card"

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Card className="group overflow-hidden ring-1 ring-border transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="overflow-hidden">
        <img
          src={post.image}
          alt={post.title}
          className="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <CardContent className="flex flex-col gap-3 pt-4">
        <time className="text-xs text-muted-foreground">{post.date}</time>
        <h2 className="text-base font-semibold leading-snug tracking-tight">
          <Link
            href={`/blog/${post.slug}`}
            className="hover:text-sky-600 transition-colors dark:hover:text-sky-400"
          >
            {post.title}
          </Link>
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {post.excerpt}
        </p>
        <Link
          href={`/blog/${post.slug}`}
          className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
        >
          Read More
          <ChevronRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  )
}
