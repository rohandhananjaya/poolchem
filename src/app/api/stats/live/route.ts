import { NextResponse } from "next/server"

import { getLiveServerStats } from "@/lib/server-stats"

export const dynamic = "force-dynamic"

export async function GET() {
  const stats = getLiveServerStats()
  return NextResponse.json(stats)
}
