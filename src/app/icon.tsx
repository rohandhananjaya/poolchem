import { ImageResponse } from "next/og"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0284c7, #0ea5e9)",
          borderRadius: 6,
          fontFamily: "Inter, sans-serif",
          fontWeight: 700,
          fontSize: 18,
          color: "white",
        }}
      >
        PB
      </div>
    ),
    { ...size },
  )
}
