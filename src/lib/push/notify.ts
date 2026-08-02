/**
 * High-level push notifications for app events.
 *
 * This is the only module pages/actions import for sending a push. It
 * orchestrates the db layer (who to notify) and the push dispatch (how to
 * deliver) — never touching Prisma or a provider directly.
 */
import "server-only";

import { getPushDevicesForUser } from "@/lib/db/push-devices";
import { getVisitById } from "@/lib/db/visits";
import { sendPush } from "./index";
import type { PushPayload, PushTarget } from "./types";

/**
 * Sends a "New visit assigned" push to the assigned tech's registered devices.
 * Mirrors the in-app realtime alert (`useRealtimeVisits`): fires only when a
 * visit is actually assigned to a tech — and, on reassignment, only when the
 * assignee changed.
 *
 * Safe to call after any visit create/update. No-ops when there's no tech, the
 * assignee is unchanged, the visit isn't found, or the tech has no devices.
 * Push delivery failures never propagate.
 */
export async function notifyVisitAssigned(input: {
  companyId: string;
  visitId: string;
  techId: string | null;
  previousTechId?: string | null;
}): Promise<void> {
  const { companyId, visitId, techId, previousTechId } = input;
  if (!techId || techId === previousTechId) return;

  const [visit, devices] = await Promise.all([
    getVisitById(visitId, companyId),
    getPushDevicesForUser(companyId, techId),
  ]);
  if (!visit || devices.length === 0) return;

  const pool = visit.pool;
  const payload: PushPayload = {
    title: "New visit assigned",
    body: [pool.name, pool.address].filter(Boolean).join(" — "),
    data: { visitId, poolId: pool.id },
  };

  const targets: PushTarget[] = devices.map((device) => ({
    token: device.token,
    platform: device.platform,
  }));

  await Promise.allSettled(targets.map((target) => sendPush(target, payload)));
}
