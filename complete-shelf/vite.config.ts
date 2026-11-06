import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  optimizeDeps: {
    // The landing document is a self-contained page that resolves Three.js from
    // its own import map; keep the scanner out of it.
    entries: ["index.html"],
  },
  build: {
    target: "es2020",
  },
});
