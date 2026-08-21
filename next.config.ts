import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ["@anthropic-ai/sdk", "openai", "@napi-rs/canvas", "tesseract.js", "pdfjs-dist", "pdf-parse", "mammoth", "adm-zip"],
};

export default nextConfig;
