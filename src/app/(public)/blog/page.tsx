import { blogPosts } from "@/lib/blog"
import { BlogCard } from "@/components/blog/BlogCard"

export default function BlogPage() {
  return (
    <div className="w-full">
      <section className="border-b border-border/60 bg-muted/30 px-4 py-16 md:px-6 md:py-20">
        <div className="mx-auto max-w-6xl">
          <span className="mb-2 inline-block text-xs font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-400">
            Our Blog
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Insights for Pool Professionals
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground text-pretty">
            Expert advice on water chemistry, pool maintenance, and running a
            smarter pool-service business — straight from the Poolbench team.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 md:px-6 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {blogPosts.map((post) => (
              <BlogCard key={post.slug} post={post} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
