// Cabeçalhos de segurança aplicados a TODAS as respostas. A CSP (com nonce) é montada no middleware.
const isProd = process.env.NODE_ENV === "production";
const security = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];
/** @type {import('next').NextConfig} */
export default {
  poweredByHeader: false,
  reactStrictMode: true,
  output: "standalone",
  productionBrowserSourceMaps: false,
  outputFileTracingIncludes: { "/api/lojas/[id]/onboarding": ["./templates/**"] },
  async headers() {
    return [
      { source: "/:path*", headers: security },
      { source: "/((?!_next/static).*)", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
    ];
  },
};
