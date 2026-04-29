import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolveBackendProxyTarget } from "./src/lib/api-config";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = resolveBackendProxyTarget(env);

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              if (/[\\/]features[\\/]reports[\\/]/.test(id)) {
                return "reports";
              }

              if (
                /[\\/]features[\\/](inventory|purchases|purchase-returns|stock-transfers)[\\/]/.test(
                  id,
                )
              ) {
                return "inventory-supply";
              }

              if (
                /[\\/]features[\\/](billing|sales-returns|customers|accounting)[\\/]/.test(
                  id,
                )
              ) {
                return "sales-finance";
              }

              if (
                /[\\/]features[\\/](admin-settings|data-management|staff|branches|shop)[\\/]/.test(
                  id,
                )
              ) {
                return "admin";
              }

              return undefined;
            }

            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
              return "react-vendor";
            }

            if (id.includes("@tanstack/react-query")) {
              return "query-vendor";
            }

            if (id.includes("react-router-dom")) {
              return "router-vendor";
            }

            if (id.includes("lucide-react")) {
              return "icon-vendor";
            }

            return "vendor";
          },
        },
      },
    },
    server: {
      proxy: {
        "/api/v1": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api/, "/api/v1"),
        },
      },
    },
  };
});
