/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfkit/exceljs are Node-only libs used exclusively in server routes — keep them external.
  serverExternalPackages: ["pdfkit", "exceljs"],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
