import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  // pdfjs-dist loads its worker/wasm/cmap assets at runtime via dynamic
  // imports that the trace cannot statically discover; keep the whole
  // package so rasterization works in the Docker image.
  outputFileTracingIncludes: {
    "/api/generate": ["./node_modules/pdfjs-dist/**/*"],
    "/api/pdf/upload": ["./node_modules/pdfjs-dist/**/*"],
  },
};

export default nextConfig;
