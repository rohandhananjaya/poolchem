/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

import {
  buildRuntimeCaching,
  composePrecacheEntries,
} from "../lib/offline/sw-policy";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  // Merge the auto-injected hashed bundle manifest with the stable public/
  // shell assets, tolerating an absent manifest in dev.
  precacheEntries: composePrecacheEntries(self.__SW_MANIFEST),
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: buildRuntimeCaching(defaultCache),
});

serwist.addEventListeners();
