/**
 * Physically-plausible bounds for a single water-test reading. Distinct from
 * {@link import("@/lib/pool-chemistry").getIdealRange}, which is the *target*
 * range for water balance — these are the outer limits a reading can never
 * exceed regardless of how out-of-balance the water is.
 *
 * Shared by the visit form (client-side feedback) and the visit Server
 * Actions (server-side enforcement) so both layers reject the same values.
 */
import { z } from "zod/v4"

export const readingsSchema = z.object({
  ph: z.number().min(0).max(14).optional(),
  freeChlorine: z.number().min(0).max(20).optional(),
  totalAlkalinity: z.number().min(0).max(500).optional(),
  calciumHardness: z.number().min(0).max(1000).optional(),
  cyanuricAcid: z.number().min(0).max(300).optional(),
  temperature: z.number().min(32).max(110).optional(),
})

export type ReadingsInput = z.infer<typeof readingsSchema>
