import * as fs from "fs";
import * as path from "path";

async function globalTeardown() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const eqIdx = trimmed.indexOf("=");
        const key = trimmed.slice(0, eqIdx);
        const value = trimmed.slice(eqIdx + 1).replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log("\n  Skipping Supabase user cleanup (missing env vars)");
    return;
  }

  const projectRef = supabaseUrl.replace("https://", "").split(".")[0];
  const apiBase = `https://${projectRef}.supabase.co/auth/v1/admin`;

  console.log("\n=== Global Teardown: Cleaning up test users ===");

  try {
    const listRes = await fetch(`${apiBase}/users`, {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apiKey: serviceRoleKey,
      },
    });

    if (!listRes.ok) {
      console.log(`  ✗ Could not list users (${listRes.status}), skipping cleanup`);
      return;
    }

    const { users } = (await listRes.json()) as {
      users: Array<{ id: string; email: string }>;
    };
    const testUsers = users.filter((u) => u.email && /^qa-(owner|tech)-\d+@example\.com$/.test(u.email));

    if (testUsers.length === 0) {
      console.log("  No test users to clean up.");
      return;
    }

    for (const u of testUsers) {
      const delRes = await fetch(`${apiBase}/users/${u.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apiKey: serviceRoleKey,
        },
      });
      const ok = delRes.ok ? "✓" : "✗";
      console.log(`  ${ok} Deleted ${u.email}`);
    }

    console.log(`  Cleaned up ${testUsers.length} test user(s).`);
  } catch (err) {
    console.log(`  ✗ Cleanup error: ${err instanceof Error ? err.message : err}`);
  }

  try {
    const statePath = path.join(__dirname, "test-state.json");
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
    const screenshotsDir = path.join(__dirname, "screenshots");
    if (fs.existsSync(screenshotsDir)) {
      fs.rmSync(screenshotsDir, { recursive: true, force: true });
    }
  } catch {}

  console.log("=== Teardown complete ===\n");
}

export default globalTeardown;
