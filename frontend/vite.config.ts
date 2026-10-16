import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import type { IncomingMessage } from "node:http";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: Object.fromEntries(["/auth", "/products", "/categories", "/clients", "/suppliers", "/factures", "/bon-achat", "/dashboard", "/health", "/invoice-options"].map(path => [path, {
      target: "http://127.0.0.1:4000", changeOrigin: true,
      // Browser navigation must load React; Axios JSON requests go to Spring.
      bypass(req: IncomingMessage) { if (req.headers.accept?.includes('text/html')) return '/index.html'; },
    }])),
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
