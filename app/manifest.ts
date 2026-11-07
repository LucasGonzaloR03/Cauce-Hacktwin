import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cauce",
    short_name: "Cauce",
    description: "Tu dinero, a tu ritmo.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3ede3",
    theme_color: "#f3ede3",
    lang: "es-AR",
    icons: [{ src: "/icon.png", sizes: "256x256", type: "image/png" }],
  };
}
