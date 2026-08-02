"use client";

import { usePathname } from "next/navigation";

import pkg from "../../../package.json";

const HIDDEN_PATHS = ["/login", "/signup"];

export function AppVersion() {
  const pathname = usePathname();
  if (pathname && HIDDEN_PATHS.some((p) => pathname.startsWith(p))) {
    return null;
  }

  return (
    <span className="pointer-events-none fixed bottom-2 right-2 z-20 select-none rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground/70 backdrop-blur-sm md:bottom-3 md:right-3">
      v{pkg.version}
    </span>
  );
}
