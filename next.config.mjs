import path from "node:path";
import { hostname, networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const isDevelopmentProfile = ["dev", "development"].includes(process.env.LOGIMARUI_PROFILE);
const criticaPort = process.env.SERVICE_CRITICA_PREFERRED_PORT || (isDevelopmentProfile ? "4104" : "4004");
const criticaServiceUrl = (process.env.CRITICA_SERVICE_URL || `http://127.0.0.1:${criticaPort}`).replace(/\/+$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.LOGIMARUI_NEXT_DIST_DIR || ".next",
  typescript: {
    tsconfigPath: process.env.LOGIMARUI_TSCONFIG_PATH || "tsconfig.json",
  },
  allowedDevOrigins: [
    hostname(),
    ...new Set(
      Object.values(networkInterfaces())
        .flat()
        .filter((address) => address?.family === "IPv4" && !address.internal)
        .map((address) => address.address),
    ),
  ],
  async rewrites() {
    return {
      beforeFiles: [{
        source: "/critica-pedidos/:path*",
        destination: `${criticaServiceUrl}/:path*`,
      }],
    };
  },
  reactCompiler: true,
  experimental: {
    proxyClientMaxBodySize: "64mb",
    preloadEntriesOnStart: false,
    webpackMemoryOptimizations: true,
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
