import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Personal Agent — WhatsApp AI",
    short_name: "Agent",
    description: "Tumhara khud ka WhatsApp AI assistant",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#070b10",
    theme_color: "#070b10",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
