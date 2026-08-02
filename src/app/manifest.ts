import type { MetadataRoute } from "next";

const APP_TITLE = "Poolbench";
const APP_DESCRIPTION = "Water chemistry, handled";
const THEME_COLOR = "#0284c7";
const BACKGROUND_COLOR = "#f5f5f5";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_TITLE} — ${APP_DESCRIPTION}`,
    short_name: APP_TITLE,
    description: APP_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
