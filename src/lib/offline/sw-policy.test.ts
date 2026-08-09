import { existsSync } from "node:fs";
import { join } from "node:path";

import { NetworkFirst, NetworkOnly } from "serwist";
import { describe, expect, it } from "vitest";

import {
  APP_SHELL_PRECACHE,
  buildRuntimeCaching,
  buildServerActionRules,
  composePrecacheEntries,
  isServerActionRequest,
} from "./sw-policy";
import type { RuntimeCaching } from "serwist";

/** `public/` directory at the repo root (vitest runs from the repo root). */
const PUBLIC_DIR = join(process.cwd(), "public");

/** The subset of `RouteMatchCallbackOptions` the matcher reads. */
interface FakeMatchOptions {
  request: { method: string };
  sameOrigin: boolean;
}

function fakeRequest(method: string): FakeMatchOptions {
  return { request: { method }, sameOrigin: true };
}

/** The rule's matcher, narrowed to the fake options shape. */
function matcherFor(rule: RuntimeCaching) {
  return rule.matcher as (options: FakeMatchOptions) => boolean;
}

describe("isServerActionRequest", () => {
  it("does not treat a same-origin GET as a Server Action", () => {
    expect(isServerActionRequest({ method: "GET" }, { sameOrigin: true })).toBe(
      false,
    );
    expect(
      isServerActionRequest({ method: undefined }, { sameOrigin: true }),
    ).toBe(false);
  });

  it("treats a same-origin POST as a Server Action", () => {
    expect(isServerActionRequest({ method: "POST" }, { sameOrigin: true })).toBe(
      true,
    );
  });

  it("never matches a cross-origin request", () => {
    expect(
      isServerActionRequest({ method: "POST" }, { sameOrigin: false }),
    ).toBe(false);
  });
});

describe("buildServerActionRules", () => {
  it("covers every non-GET method with a NetworkOnly handler", () => {
    const rules = buildServerActionRules();
    expect(rules.map((rule) => rule.method)).toEqual([
      "DELETE",
      "HEAD",
      "PATCH",
      "POST",
      "PUT",
    ]);
    for (const rule of rules) {
      expect(rule.handler).toBeInstanceOf(NetworkOnly);
    }
  });

  it("matches a same-origin POST before any defaultCache rule", () => {
    // A stand-in for the NetworkFirst `rsc`/`others` rules in prod defaultCache
    // — both GET-bucketed, so a POST must resolve to the Server Action rule.
    const defaultCache: RuntimeCaching[] = [
      { matcher: () => true, handler: new NetworkFirst() },
      { matcher: () => true, handler: new NetworkFirst() },
    ];
    const rules = buildRuntimeCaching(defaultCache);

    const post = fakeRequest("POST");
    const firstMatch = rules.find(
      (rule) =>
        rule.method === post.request.method && matcherFor(rule)(post) === true,
    );
    expect(firstMatch?.handler).toBeInstanceOf(NetworkOnly);
    expect(rules.indexOf(firstMatch!)).toBeLessThan(
      rules.indexOf(defaultCache[0]),
    );
  });

  it("does not route a same-origin GET into the Server Action guard", () => {
    const rules = buildRuntimeCaching([]);
    const get = fakeRequest("GET");
    for (const rule of rules) {
      if (rule.method === get.request.method) {
        expect(matcherFor(rule)(get)).toBe(false);
      }
    }
  });
});

describe("APP_SHELL_PRECACHE", () => {
  it("holds only stable root-relative URLs", () => {
    for (const entry of APP_SHELL_PRECACHE) {
      expect(entry.url.startsWith("/")).toBe(true);
      expect(entry.url).not.toContain("_next");
    }
  });

  it("maps every icon entry to an existing public/ file", () => {
    for (const entry of APP_SHELL_PRECACHE) {
      if (!entry.url.startsWith("/icons/")) continue;
      expect(existsSync(`${PUBLIC_DIR}${entry.url}`), entry.url).toBe(true);
    }
  });

  it("precaches the manifest route (served by src/app/manifest.ts)", () => {
    expect(APP_SHELL_PRECACHE).toContainEqual({
      url: "/manifest.webmanifest",
      revision: null,
    });
  });
});

describe("composePrecacheEntries", () => {
  it("yields only the shell when the manifest is absent", () => {
    expect(composePrecacheEntries(undefined)).toEqual(APP_SHELL_PRECACHE);
    expect(composePrecacheEntries(undefined)).not.toContainEqual(undefined);
  });

  it("merges manifest and shell entries, normalizing string URLs", () => {
    const manifest = ["/_next/static/chunks/abc.js", { url: "/app.js" }];
    const composed = composePrecacheEntries(manifest);
    expect(composed.map((entry) => entry.url)).toEqual([
      "/_next/static/chunks/abc.js",
      "/app.js",
      ...APP_SHELL_PRECACHE.map((entry) => entry.url),
    ]);
  });

  it("dedupes by URL, keeping the first occurrence", () => {
    const manifest = [{ url: "/icons/icon-192.png", revision: "abc123" }];
    const composed = composePrecacheEntries(manifest);
    expect(
      composed.filter((entry) => entry.url === "/icons/icon-192.png"),
    ).toHaveLength(1);
    // Hashed manifest entry wins the collision over the revision-null shell one.
    expect(
      composed.find((entry) => entry.url === "/icons/icon-192.png")?.revision,
    ).toBe("abc123");
  });

  it("drops entries with no usable URL", () => {
    const manifest = ["", { url: "" }, { url: "/ok.js" }];
    const composed = composePrecacheEntries(manifest, []);
    expect(composed).toEqual([{ url: "/ok.js" }]);
  });
});
