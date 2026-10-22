import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Clearstep",
    short_name: "Clearstep",
    description:
      "Turn an unstructured brain dump into a small, editable plan that starts with one clear action.",
    start_url: "/compose",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f3efe4",
    theme_color: "#194b36",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "New plan",
        short_name: "New plan",
        description: "Start a new brain dump",
        url: "/compose",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "My plans",
        short_name: "Plans",
        description: "Open saved plans",
        url: "/plans",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
