import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        // faz cache de todo o app (shell) → abre e funciona offline
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html", // rotas do SPA resolvem offline
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // imagens públicas do Supabase Storage (foto do aluno + arte da carteirinha)
            // → depois de vistas online, ficam disponíveis offline
            urlPattern: ({ url }) => url.href.includes("/storage/v1/object/public/"),
            handler: "CacheFirst",
            options: {
              cacheName: "sysbus-midia",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // fonte Inter (Google Fonts) → visual consistente offline após a 1ª carga
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "sysbus-fontes",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      includeAssets: ["favicon.svg", "itaiba-logo.png"],
      manifest: {
        name: "SYSBUS — Transporte Universitário",
        short_name: "SYSBUS",
        description: "Carteirinha e reserva do transporte universitário.",
        theme_color: "#0d2238",
        background_color: "#0d2238",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "/itaiba-logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/itaiba-logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/itaiba-logo.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
