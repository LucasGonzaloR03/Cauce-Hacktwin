import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cauce",
    short_name: "Cauce",
    description: "Tu dinero, a tu ritmo.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f4",
    theme_color: "#f5f7f4",
    lang: "es-AR",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
