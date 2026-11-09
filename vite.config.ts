import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Vite builds the client from `client/` into `dist/public` (same as our other
// Vercel projects). The `/api/*` serverless functions are compiled by Vercel,
// not Vite, so they live outside this root.
export default defineConfig({
  root: path.resolve(__dirname, "client"),
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  server: {
    // `vercel dev` serves the functions; when running plain `vite` you can point
    // this at a running `vercel dev` instance. See README.
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
