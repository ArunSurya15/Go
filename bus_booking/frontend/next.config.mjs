/** @type {import('next').NextConfig} */
const backend =
  process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const nextConfig = {
  async rewrites() {
    const base = String(backend).replace(/\/$/, "");
    return [{ source: "/api/:path*", destination: `${base}/api/:path*` }];
  },
};

export default nextConfig;
