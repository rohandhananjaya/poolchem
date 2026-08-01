import Image from "next/image"

export interface CompanyLogoProps {
  src: string
  alt: string
  /** Target height in px; the width scales to preserve the logo's aspect ratio. */
  size: number
  className?: string
}

function isR2Hosted(src: string): boolean {
  const publicUrl = process.env.R2_PUBLIC_URL
  if (!publicUrl) return false
  return src.startsWith(`${publicUrl.replace(/\/$/, "")}/`)
}

/**
 * Renders a company logo at its natural aspect ratio, constrained to the given
 * height. R2-hosted logos (the current upload flow) get `next/image`
 * optimization. Anything else — e.g. a legacy externally-hosted URL from before
 * uploads existed — falls back to a plain `<img>`, since `next/image` throws for
 * any host not in `next.config.ts`'s `images.remotePatterns`, which only ever
 * lists the R2 host.
 */
export function CompanyLogo({ src, alt, size, className }: CompanyLogoProps) {
  const style = { height: size, width: "auto" } as const

  if (isR2Hosted(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        sizes="256px"
        style={style}
        className={className}
      />
    )
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} style={style} className={className} />
}
