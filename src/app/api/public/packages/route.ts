import { NextResponse } from "next/server"

import { getAllPackages } from "@/lib/db/packages"

export const dynamic = "force-dynamic"

export async function GET() {
  const packages = await getAllPackages()
  return NextResponse.json(
    { packages },
    { headers: { "Cache-Control": "no-store" } },
  )
}
