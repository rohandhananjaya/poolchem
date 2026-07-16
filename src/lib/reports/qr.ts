import "server-only";

import qrcode from "qrcode";

export async function generateQRDataUrl(url: string): Promise<string> {
  const svg = await qrcode.toString(url, {
    type: "svg",
    margin: 1,
    color: { dark: "#171717", light: "#ffffff" },
  });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
