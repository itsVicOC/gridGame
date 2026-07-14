import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "纸径 · 每日路径拼图", short_name: "纸径", description: "每天一条路，连接所有线索。",
        theme_color: "#f3ead7", background_color: "#f3ead7", display: "standalone", start_url: ".",
        icons: [{ src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
      },
      workbox: {
        navigateFallback: "index.html",
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.includes("/v1/"), handler: "NetworkOnly",
        }],
      },
    }),
  ],
  server: { port: 5173 },
});
