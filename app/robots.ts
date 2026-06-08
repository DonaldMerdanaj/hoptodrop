import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/about", "/support", "/rider/login"],
        disallow: [
          "/admin",
          "/client",
          "/dashboard",
          "/driver",
          "/driver-login",
          "/login",
          "/rider/dashboard",
          "/api"
        ]
      }
    ],
    sitemap: "https://www.hoptodrop.com/sitemap.xml",
    host: "https://www.hoptodrop.com"
  };
}
