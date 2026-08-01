import { describe, expect, it } from "vitest";
import { buildPostmanCollection } from "./postman-collection";

const BASE_URL = "https://api.example.com";

function parse(collection: string) {
  return JSON.parse(collection);
}

describe("buildPostmanCollection", () => {
  it("returns a valid Postman v2.1 collection", () => {
    const doc = parse(buildPostmanCollection(BASE_URL));

    expect(doc.info.name).toBe("Poolbench API");
    expect(doc.info.schema).toBe(
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    );
    expect(doc.info._postman_id).toBeTruthy();
  });

  it("injects baseUrl as a variable and strips trailing slashes", () => {
    const doc = parse(buildPostmanCollection("https://api.example.com/"));

    const baseUrl = doc.variable.find((v) => v.key === "baseUrl");
    expect(baseUrl.value).toBe("https://api.example.com");
  });

  it("ships an apiKey placeholder variable", () => {
    const doc = parse(buildPostmanCollection(BASE_URL));

    const apiKey = doc.variable.find((v) => v.key === "apiKey");
    expect(apiKey.value).toBe("pb_live_your_api_key");
  });

  it("uses collection-level bearer auth bound to the apiKey variable", () => {
    const doc = parse(buildPostmanCollection(BASE_URL));

    expect(doc.auth.type).toBe("bearer");
    expect(doc.auth.bearer[0].key).toBe("token");
    expect(doc.auth.bearer[0].value).toBe("{{apiKey}}");
  });

  it("covers all five v1 endpoints across folders", () => {
    const doc = parse(buildPostmanCollection(BASE_URL));

    const names = doc.item.flatMap((folder) =>
      folder.item.map((r) => `${folder.name}/${r.name}`),
    );
    expect(names).toEqual([
      "Pools/List pools",
      "Pools/Get a pool",
      "Visits/List visits",
      "Visits/Get a visit",
      "Schedule/List schedule",
    ]);
  });

  it("roots every request under the baseUrl variable", () => {
    const doc = parse(buildPostmanCollection(BASE_URL));

    const urls = doc.item.flatMap((folder) => folder.item.map((r) => r.request.url.raw));
    for (const url of urls) {
      expect(url.startsWith("{{baseUrl}}/api/v1/")).toBe(true);
    }
  });

  it("adds a 200 example response to every request", () => {
    const doc = parse(buildPostmanCollection(BASE_URL));

    const requests = doc.item.flatMap((folder) => folder.item);
    for (const r of requests) {
      expect(r.response.some((res) => res.code === 200)).toBe(true);
    }
  });

  it("documents the error envelope with 401 and 429 examples on the list-pools request", () => {
    const doc = parse(buildPostmanCollection(BASE_URL));

    const listPools = doc.item[0].item[0];
    const codes = listPools.response.map((res) => res.code);
    expect(codes).toContain(401);
    expect(codes).toContain(429);
  });

  it("runs a test script asserting a 200 data envelope", () => {
    const doc = parse(buildPostmanCollection(BASE_URL));

    const script = doc.event.find((e) => e.listen === "test");
    const body = script.script.exec.join("\n");
    expect(body).toContain("pm.response.to.have.status(200)");
    expect(body).toContain("have.property('data')");
  });
});
