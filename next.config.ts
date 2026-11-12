import type { NextConfig } from "next";

// The browser only ever talks to this app's own origin. `/api/*` is proxied to the WorkDesk API, so the
// HttpOnly refresh cookie (SameSite=Strict, Path=/api/auth) is first-party and no CORS is involved.
// Set API_ORIGIN to wherever the backend runs (server-side variable, not exposed to the browser).
const API_ORIGIN = (process.env.API_ORIGIN ?? "http://localhost:4000").replace(/\/+$/, "");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default config;
