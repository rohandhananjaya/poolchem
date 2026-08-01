/**
 * Pure Postman collection builder for the Poolbench `/api/v1` REST API. No I/O,
 * no Prisma import — the same "pure domain logic" shape as {@link "./keys"},
 * so the artifact can be unit-tested and its base URL injected by the caller.
 *
 * The returned string is a Postman Collection v2.1 document with a `{{baseUrl}}`
 * variable (defaulting to the resolved app origin) and a `{{apiKey}}` variable
 * for the bearer token. Consumers must only pass a base URL — never a secret.
 */

/** Stable id for the generated collection, so re-downloads diff cleanly. */
const POSTMAN_COLLECTION_ID = "a1b2c3d4-e5f6-4789-abcd-0123456789ab";

/** Placeholder for the `{{apiKey}}` variable — the caller pastes their key. */
const API_KEY_PLACEHOLDER = "pb_live_your_api_key";

interface PostmanQueryParam {
  key: string;
  value: string;
  description?: string;
}

interface PostmanPathVariable {
  key: string;
  value: string;
  description?: string;
}

interface PostmanUrl {
  raw: string;
  host: string[];
  path: string[];
  query?: PostmanQueryParam[];
  variable?: PostmanPathVariable[];
}

interface PostmanRequest {
  name: string;
  request: {
    method: "GET";
    header: unknown[];
    url: PostmanUrl;
    description: string;
  };
  response: PostmanExampleResponse[];
}

interface PostmanExampleResponse {
  name: string;
  originalRequest: { method: "GET"; header: unknown[]; url: PostmanUrl };
  status: string;
  code: number;
  _postman_previewlanguage: string;
  header: { key: string; value: string }[];
  body: string;
}

interface PostmanFolder {
  name: string;
  description: string;
  item: PostmanRequest[];
}

/** Builds a `{{baseUrl}}`-rooted URL object for a request path. */
function requestUrl(
  pathSegments: string[],
  options: { query?: PostmanQueryParam[]; pathVariables?: PostmanPathVariable[] } = {},
): PostmanUrl {
  const path = ["api", "v1", ...pathSegments];
  const rawPath = path.join("/");
  const queryString = options.query?.length
    ? `?${options.query.map((q) => `${q.key}=${q.value}`).join("&")}`
    : "";
  return {
    raw: `{{baseUrl}}/${rawPath}${queryString}`,
    host: ["{{baseUrl}}"],
    path,
    ...(options.query ? { query: options.query } : {}),
    ...(options.pathVariables ? { variable: options.pathVariables } : {}),
  };
}

/** A single GET request with its example 200 response attached. */
function request(
  name: string,
  description: string,
  url: PostmanUrl,
  exampleBody: string,
): PostmanRequest {
  const originalRequest = { method: "GET" as const, header: [], url };
  return {
    name,
    request: { method: "GET", header: [], url, description },
    response: [
      {
        name: "200 OK",
        originalRequest,
        status: "OK",
        code: 200,
        _postman_previewlanguage: "json",
        header: [{ key: "Content-Type", value: "application/json" }],
        body: exampleBody,
      },
    ],
  };
}

/** Trims trailing slashes so `baseUrl` + `/api/v1/...` never double up. */
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/** Example `{ data: ... }` envelopes, shaped after the real v1 responses. */
const EXAMPLES = {
  pools: `{
  "data": {
    "pools": [
      {
        "id": "cm8poolsample0001",
        "name": "Backyard Oasis",
        "address": "123 Maple Ave, Springfield",
        "volume": 25000,
        "image": null,
        "qrCode": "pb-qr-abc123",
        "publicToken": "07c3f2d0-1a9b-4e5c-8f2a-6b3d4e5f6071",
        "homeownerEmail": "owner@example.com",
        "homeownerPhone": "+15551234567",
        "notes": null,
        "companyId": "cm8companysample01",
        "isActive": true,
        "createdAt": "2026-06-01T09:00:00.000Z",
        "updatedAt": "2026-07-20T15:30:00.000Z",
        "lastVisitAt": "2026-07-20T15:30:00.000Z"
      }
    ]
  }
}`,
  pool: `{
  "data": {
    "pool": {
      "id": "cm8poolsample0001",
      "name": "Backyard Oasis",
      "address": "123 Maple Ave, Springfield",
      "volume": 25000,
      "image": null,
      "qrCode": "pb-qr-abc123",
      "publicToken": "07c3f2d0-1a9b-4e5c-8f2a-6b3d4e5f6071",
      "homeownerEmail": "owner@example.com",
      "homeownerPhone": "+15551234567",
      "notes": null,
      "companyId": "cm8companysample01",
      "isActive": true,
      "createdAt": "2026-06-01T09:00:00.000Z",
      "updatedAt": "2026-07-20T15:30:00.000Z"
    }
  }
}`,
  visits: `{
  "data": {
    "visits": [
      {
        "id": "cm8visitsample0001",
        "poolName": "Backyard Oasis",
        "address": "123 Maple Ave, Springfield",
        "techName": "Alex Rivera",
        "date": "2026-07-20T15:30:00.000Z",
        "score": 92
      }
    ],
    "total": 1,
    "page": 1
  }
}`,
  visit: `{
  "data": {
    "visit": {
      "id": "cm8visitsample0001",
      "poolId": "cm8poolsample0001",
      "techId": "cm8techsample0001",
      "notes": "Added 2 lb of shock after heavy rain.",
      "status": "COMPLETED",
      "weatherNotes": "Thunderstorms",
      "cancellationReason": null,
      "publicToken": "6f8e1c2a-9b3d-4e7f-8a5c-2d0e1f2a3b4c",
      "scheduledAt": "2026-07-20T14:00:00.000Z",
      "nextServiceDate": "2026-07-27T00:00:00.000Z",
      "createdAt": "2026-07-20T13:45:00.000Z",
      "updatedAt": "2026-07-20T15:30:00.000Z",
      "pool": {
        "id": "cm8poolsample0001",
        "name": "Backyard Oasis",
        "address": "123 Maple Ave, Springfield",
        "volume": 25000,
        "image": null,
        "qrCode": "pb-qr-abc123",
        "publicToken": "07c3f2d0-1a9b-4e5c-8f2a-6b3d4e5f6071",
        "homeownerEmail": "owner@example.com",
        "homeownerPhone": "+15551234567",
        "notes": null,
        "companyId": "cm8companysample01",
        "isActive": true,
        "createdAt": "2026-06-01T09:00:00.000Z",
        "updatedAt": "2026-07-20T15:30:00.000Z"
      },
      "tech": {
        "id": "cm8techsample0001",
        "email": "alex@example.com",
        "supabaseId": null,
        "name": "Alex Rivera",
        "phone": "+15559876543",
        "role": "TECH",
        "companyId": "cm8companysample01",
        "createdAt": "2026-01-10T09:00:00.000Z",
        "updatedAt": "2026-01-10T09:00:00.000Z"
      },
      "waterReadings": [
        {
          "id": "cm8readingsample001",
          "visitId": "cm8visitsample0001",
          "ph": 7.4,
          "freeChlorine": 1.5,
          "totalAlkalinity": 90,
          "calciumHardness": 220,
          "cyanuricAcid": 45,
          "temperature": 84,
          "createdAt": "2026-07-20T15:29:00.000Z"
        }
      ],
      "chemicalsAdded": [
        {
          "id": "cm8chemsample0001",
          "visitId": "cm8visitsample0001",
          "name": "Chlorine granules",
          "amount": 2,
          "unit": "lb",
          "createdAt": "2026-07-20T15:29:30.000Z"
        }
      ]
    }
  }
}`,
  schedule: `{
  "data": {
    "visits": [
      {
        "id": "cm8visitsample0002",
        "poolName": "Backyard Oasis",
        "address": "123 Maple Ave, Springfield",
        "homeownerPhone": "+15551234567",
        "status": "DRAFT",
        "scheduledAt": "2026-07-24T09:00:00.000Z",
        "effectiveDate": "2026-07-24T09:00:00.000Z",
        "health": {
          "score": 92,
          "status": "EXCELLENT"
        },
        "assignedTech": {
          "id": "cm8techsample0001",
          "name": "Alex Rivera"
        }
      }
    ],
    "total": 1,
    "page": 1
  }
}`,
  unauthorized: `{
  "error": {
    "code": "AUTH",
    "message": "Invalid or revoked API key."
  }
}`,
  rateLimited: `{
  "error": {
    "code": "RATE_LIMIT",
    "message": "Too many requests. Please retry later."
  }
}`,
};

/** Shared query params for the paginated list endpoints. */
function listQuery(): PostmanQueryParam[] {
  return [
    {
      key: "page",
      value: "1",
      description: "Page number, starting at 1. Defaults to 1.",
    },
    {
      key: "poolId",
      value: "{{poolId}}",
      description: "Optional — narrow results to one pool.",
    },
    {
      key: "fromDate",
      value: "2026-07-01",
      description: "Optional — inclusive start date (YYYY-MM-DD).",
    },
    {
      key: "toDate",
      value: "2026-07-31",
      description: "Optional — inclusive end date (YYYY-MM-DD).",
    },
  ];
}

/** Error examples attached to the first request so the envelope is documented once. */
function errorExamples(url: PostmanUrl): PostmanExampleResponse[] {
  const originalRequest = { method: "GET" as const, header: [], url };
  return [
    {
      name: "401 Unauthorized",
      originalRequest,
      status: "Unauthorized",
      code: 401,
      _postman_previewlanguage: "json",
      header: [{ key: "Content-Type", value: "application/json" }],
      body: EXAMPLES.unauthorized,
    },
    {
      name: "429 Too Many Requests",
      originalRequest,
      status: "Too Many Requests",
      code: 429,
      _postman_previewlanguage: "json",
      header: [
        { key: "Content-Type", value: "application/json" },
        { key: "Retry-After", value: "60" },
      ],
      body: EXAMPLES.rateLimited,
    },
  ];
}

/** Builds the Pools folder: list + single-pool requests. */
function poolsFolder(): PostmanFolder {
  const listUrl = requestUrl(["pools"]);
  const poolIdUrl = requestUrl(["pools", ":poolId"], {
    pathVariables: [
      {
        key: "poolId",
        value: "cm8poolsample0001",
        description: "The id of a pool returned by `GET /api/v1/pools`.",
      },
    ],
  });

  return {
    name: "Pools",
    description: "Read-only access to the company's pools.",
    item: [
      {
        name: "List pools",
        request: {
          method: "GET",
          header: [],
          url: listUrl,
          description: "Returns all pools for the API key's company, newest first.",
        },
        response: [
          {
            name: "200 OK",
            originalRequest: { method: "GET", header: [], url: listUrl },
            status: "OK",
            code: 200,
            _postman_previewlanguage: "json",
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "X-RateLimit-Limit", value: "60" },
              { key: "X-RateLimit-Remaining", value: "59" },
            ],
            body: EXAMPLES.pools,
          },
          ...errorExamples(listUrl),
        ],
      },
      request(
        "Get a pool",
        "Returns a single pool by id. 404 with an `error` envelope if it doesn't belong to the key's company.",
        poolIdUrl,
        EXAMPLES.pool,
      ),
    ],
  };
}

/** Builds the Visits folder: report-list + single-visit requests. */
function visitsFolder(): PostmanFolder {
  const listUrl = requestUrl(["visits"], { query: listQuery() });
  const visitIdUrl = requestUrl(["visits", ":visitId"], {
    pathVariables: [
      {
        key: "visitId",
        value: "cm8visitsample0001",
        description: "The id of a visit returned by `GET /api/v1/visits`.",
      },
    ],
  });

  return {
    name: "Visits",
    description:
      "Paginated, filterable history of completed visits, plus a single-visit detail endpoint.",
    item: [
      request(
        "List visits",
        "Returns completed visits with their water-health scores. Supports `page`, `poolId`, `fromDate` and `toDate` query params.",
        listUrl,
        EXAMPLES.visits,
      ),
      request(
        "Get a visit",
        "Returns a single visit including its pool, tech, water readings and chemicals added.",
        visitIdUrl,
        EXAMPLES.visit,
      ),
    ],
  };
}

/** Builds the Schedule folder: the paginated, filterable schedule list. */
function scheduleFolder(): PostmanFolder {
  const listUrl = requestUrl(["schedule"], {
    query: [
      ...listQuery(),
      {
        key: "status",
        value: "scheduled",
        description:
          "Optional — `scheduled` (default), `all`, `cancelled`, `completed` or `in_progress`.",
      },
    ],
  });

  return {
    name: "Schedule",
    description: "Upcoming and past visits by planned time.",
    item: [
      request(
        "List schedule",
        "Returns the company's visits ordered by when they are planned for, with optional status/date filters.",
        listUrl,
        EXAMPLES.schedule,
      ),
    ],
  };
}

/**
 * Generates a Postman Collection v2.1 JSON document for the `/api/v1` API.
 *
 * @param baseUrl - The app's public origin, e.g. `https://app.example.com`
 *   (no trailing slash). Used as the `{{baseUrl}}` variable default.
 * @returns The serialized collection as a JSON string.
 */
export function buildPostmanCollection(baseUrl: string): string {
  const collection = {
    info: {
      _postman_id: POSTMAN_COLLECTION_ID,
      name: "Poolbench API",
      description:
        "Read-only REST API for the Poolbench `api_access` plan feature.\n\n" +
        "Authenticate with `Authorization: Bearer <your-api-key>` (set via the `{{apiKey}}` " +
        "collection variable). Keys are generated on the API Keys page — never embed one in " +
        "browser-side code.\n\n" +
        "Every response carries `X-RateLimit-*` headers; keys are limited to 60 requests/minute. " +
        "Errors always use a `{ \"error\": { \"code\", \"message\" } }` envelope.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [
      { key: "baseUrl", value: normalizeBaseUrl(baseUrl), type: "string" },
      { key: "apiKey", value: API_KEY_PLACEHOLDER, type: "string" },
      { key: "poolId", value: "cm8poolsample0001", type: "string" },
    ],
    auth: {
      type: "bearer",
      bearer: [{ key: "token", value: "{{apiKey}}", type: "string" }],
    },
    event: [
      {
        listen: "test",
        script: {
          type: "text/javascript",
          exec: [
            'pm.test("status is 200", function () {',
            "  pm.response.to.have.status(200);",
            "});",
            'pm.test("response body has a data envelope", function () {',
            "  pm.expect(pm.response.json()).to.have.property('data');",
            "});",
          ],
        },
      },
    ],
    item: [poolsFolder(), visitsFolder(), scheduleFolder()],
  };

  return JSON.stringify(collection, null, 2);
}

/** The collection's display name — reused as the download filename stem. */
export function postmanCollectionFileName(): string {
  return "poolbench-api.postman_collection.json";
}
