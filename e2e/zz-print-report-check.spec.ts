import { test, expect } from "@playwright/test"

const REPORT_TOKEN = "1d88e7f4-ddde-4324-acd9-ccf48eb2e06c"

test("printable report border/margins are independent of @page overrides", async ({
  page,
}) => {
  await page.goto(`/report/${REPORT_TOKEN}`)
  await page.emulateMedia({ media: "print" })

  const outer = page.locator(".printable-report")
  const style = await outer.evaluate((el) => {
    const before = getComputedStyle(el, "::before")
    const self = getComputedStyle(el)
    return {
      beforeInset: `${before.top} ${before.right} ${before.bottom} ${before.left}`,
      beforePosition: before.position,
      selfPaddingTop: self.paddingTop,
      selfPaddingLeft: self.paddingLeft,
    }
  })
  console.log("computed:", style)

  // 0.5cm ≈ 18.9px — border must be inset from the true page edge, not at 0.
  expect(style.beforePosition).toBe("fixed")
  const insetTop = parseFloat(style.beforeInset)
  expect(insetTop).toBeGreaterThan(10)

  // print:p-10 (2.5rem = 40px) — guaranteed content padding independent of @page.
  expect(parseFloat(style.selfPaddingTop)).toBeGreaterThanOrEqual(35)
  expect(parseFloat(style.selfPaddingLeft)).toBeGreaterThanOrEqual(35)

  await page.screenshot({
    path: "e2e/screenshots/print-report-public-v2.png",
    fullPage: true,
  })
})
