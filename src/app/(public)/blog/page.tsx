import Link from "next/link";
import { ChevronRight } from "lucide-react";

const blogPosts = [
  {
    image: "/images/blog-lsi-chemistry.jpg",
    date: "June 15, 2026",
    title: "The Science Behind Langelier Saturation Index",
    excerpt:
      "Understanding LSI is key to balanced water. Here's how Poolbench calculates it automatically so you don't have to.",
  },
  {
    image: "/images/blog-digital-upgrade.jpg",
    date: "May 28, 2026",
    title: "5 Signs Your Pool Service Needs a Digital Upgrade",
    excerpt:
      "From lost paper reports to inconsistent dosing — if these sound familiar, it's time to digitize your workflow.",
  },
  {
    image: "/images/blog-chemistry-equip.jpg",
    date: "April 10, 2026",
    title: "Why Water Chemistry Matters for Equipment Longevity",
    excerpt:
      "Balanced water doesn't just look good — it protects your pumps, filters, and heaters from premature wear.",
  },
  {
    image: "/images/blog-seasonal-maintenance.jpg",
    date: "March 22, 2026",
    title: "Seasonal Pool Maintenance: A Month-by-Month Guide",
    excerpt:
      "From spring opening to winter closing, here's the comprehensive maintenance calendar every pool service professional needs.",
  },
  {
    image: "/images/blog-ph-alkalinity.jpg",
    date: "February 14, 2026",
    title: "Understanding pH, Alkalinity, and Calcium Hardness",
    excerpt:
      "The three pillars of water chemistry — get them right and your pools practically take care of themselves.",
  },
  {
    image: "/images/blog-tech-training.jpg",
    date: "January 8, 2026",
    title: "How to Train New Pool Service Technicians Faster",
    excerpt:
      "Effective onboarding strategies that get techs up to speed on water testing, chemical dosing, and customer communication.",
  },
];

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
              <article
                key={post.title}
                className="group overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-52 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <time className="text-xs text-muted-foreground">
                    {post.date}
                  </time>
                  <h2 className="mt-3 text-base font-semibold leading-snug tracking-tight">
                    <Link
                      href="#"
                      className="hover:text-sky-600 transition-colors dark:hover:text-sky-400"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <Link
                    href="#"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300"
                  >
                    Read More
                    <ChevronRight className="size-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
