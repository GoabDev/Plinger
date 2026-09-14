import type { MetadataRoute } from "next";
import { siteDescription, siteName } from "../lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: siteName,
    description: siteDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7f9",
    theme_color: "#15111f",
    icons: [
      {
        src: "/plinger-icon.png",
        sizes: "1254x1254",
        type: "image/png",
      },
    ],
  };
}
