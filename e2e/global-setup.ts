import { execSync } from "child_process";

async function globalSetup() {
  console.log("\n=== Global Setup: Seeding database ===");
  try {
    execSync("npm run db:seed", { stdio: "inherit", cwd: process.cwd() });
    console.log("  ✓ Database seeded");
  } catch (e) {
    console.error(
      "  ✗ Seed failed:",
      e instanceof Error ? e.message : String(e),
    );
    process.exit(1);
  }

  console.log("  Checking dev server on https://localhost:3000 ...");
  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const res = await fetch("https://localhost:3000/login");
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
    if (res.status >= 200 && res.status < 500) {
      console.log(`  ✓ Server responded with ${res.status}`);
    } else {
      console.error(`  ✗ Server returned ${res.status}`);
      process.exit(1);
    }
  } catch {
    console.error(
      "  ✗ Dev server is not running. Start it with `npm run dev` in another terminal.",
    );
    process.exit(1);
  }

  console.log("=== Setup complete ===\n");
}

export default globalSetup;
