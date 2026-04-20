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
