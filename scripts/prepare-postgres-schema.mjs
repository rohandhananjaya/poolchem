// Derives prisma/schema.postgres.prisma from prisma/schema.prisma by swapping
// the datasource provider — keeps one source of truth for models while
// production (Postgres) and local dev (SQLite) each get a matching schema.
// Regenerated on every build; not committed (see .gitignore).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const schemaPath = fileURLToPath(
  new URL("../prisma/schema.prisma", import.meta.url),
);
const outputPath = fileURLToPath(
  new URL("../prisma/schema.postgres.prisma", import.meta.url),
);

const source = readFileSync(schemaPath, "utf8");

const marker = 'provider = "sqlite"';
if (!source.includes(marker)) {
  throw new Error(
    `prepare-postgres-schema: expected to find \`${marker}\` in prisma/schema.prisma — schema may have changed shape.`,
  );
}

const derived = source.replace(marker, 'provider = "postgresql"');

writeFileSync(outputPath, derived);
console.log(`Wrote ${outputPath}`);
