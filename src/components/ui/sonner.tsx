"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

/**
 * App toast host. Rendered once in the root layout; fire toasts anywhere with
 * `import { toast } from "sonner"`.
 *
 * Colors are driven off the app's CSS custom properties so toasts match the
 * active theme (light/dark via the `.dark` class) without pulling in
 * `next-themes`. `theme="system"` lets Sonner pick its own light/dark chrome
 * from the OS preference for the bits not covered by the vars.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
