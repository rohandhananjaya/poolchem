import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { blogPosts, getBlogPost } from "@/lib/blog"
import { Button } from "@/components/ui/button"

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }))
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getBlogPost(slug)
  if (!post) notFound()

  return (
    <div className="w-full">
      <section className="border-b border-border/60 bg-muted/30 px-4 py-16 md:px-6 md:py-20">
        <div className="mx-auto max-w-3xl">
          <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
            <Link href="/blog">
              <ChevronLeft className="size-4" />
              Back to Blog
            </Link>
          </Button>

          <time className="text-xs text-muted-foreground">{post.date}</time>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-lg leading-7 text-muted-foreground">
            {post.excerpt}
          </p>
        </div>
      </section>

      <section className="px-4 py-12 md:px-6 md:py-16">
        <div className="mx-auto max-w-3xl">
          <div className="overflow-hidden rounded-2xl border border-border">
            <img
              src={post.image}
              alt={post.title}
              className="aspect-[21/9] w-full object-cover"
            />
          </div>

          <article className="prose prose-gray dark:prose-invert mt-10 max-w-none">
            {post.content.map((block, i) => {
              if (block.type === "h2") {
                return (
                  <h2 key={i} className="mt-10 mb-4 text-2xl font-bold tracking-tight">
                    {block.text}
                  </h2>
                )
              }
              if (block.type === "h3") {
                return (
                  <h3 key={i} className="mt-8 mb-3 text-xl font-semibold tracking-tight">
                    {block.text}
                  </h3>
                )
              }
              return (
                <p key={i} className="mb-5 leading-7 text-muted-foreground">
                  {block.text}
                </p>
              )
            })}
          </article>

          <div className="mt-12 border-t border-border pt-8">
            <Button variant="outline" asChild>
              <Link href="/blog">
                <ChevronLeft className="size-4" />
                Back to Blog
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
