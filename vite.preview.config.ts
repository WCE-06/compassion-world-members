import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "preview",
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../preview-dist",
    emptyOutDir: true,
  },
});
