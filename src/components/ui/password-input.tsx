import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

type PasswordInputProps = React.ComponentProps<"input"> & { containerClassName?: string }

function PasswordInput({
  className,
  containerClassName,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false)
  const Icon = visible ? EyeOff : Eye

  return (
    <div className={cn("relative", containerClassName)}>
      <input
        data-slot="input"
        type={visible ? "text" : "password"}
        className={cn(
          "flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-1 pr-9 text-sm shadow-xs transition-[color,box-shadow] outline-none",
          "file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          "dark:bg-input/30",
          className,
        )}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        tabIndex={-1}
        className="absolute right-0 top-0 h-full px-2.5 text-muted-foreground hover:text-foreground"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
      >
        <Icon className="size-4" />
        <span className="sr-only">
          {visible ? "Hide password" : "Show password"}
        </span>
      </Button>
    </div>
  )
}

export { PasswordInput }
