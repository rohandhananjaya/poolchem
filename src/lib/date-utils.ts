/** Local midnight-to-midnight window for "today". */
export function todayRange(): { gte: Date; lt: Date } {
  const now = new Date()
  const gte = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const lt = new Date(gte)
  lt.setDate(lt.getDate() + 1)
  return { gte, lt }
}
