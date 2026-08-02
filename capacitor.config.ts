import type { CapacitorConfig } from "@capacitor/cli";

// Poolbench native app (Capacitor shell).
//
// The shell loads the deployed Next.js app via `server.url` — the Next.js app
// is server-rendered (Server Components / Server Actions), so it cannot be
// statically bundled into the app. Point this at the production Vercel
// deployment for store builds; a live dev server (https, LAN-reachable) for
// local testing.
//
// Resolved at `cap sync` time and baked into the native projects. Changing it
// requires a re-sync:
//   POOLBENCH_NATIVE_URL="https://poolbench.vercel.app" npx cap sync
// Falls back to NEXT_PUBLIC_APP_URL (loaded from .env by the Capacitor CLI).
const config: CapacitorConfig = {
  appId: "com.poolbench.app",
  appName: "Poolbench",
  webDir: "public",
  server: {
    url:
      process.env.POOLBENCH_NATIVE_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      "https://REPLACE-ME.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "automatic",
  },
};

export default config;
