import { defineConfig } from "vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import viteTs from "vite-tsconfig-paths"
import tailwindcss from "tailwindcss"

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    viteTs(),
  ],
  css: {
    postcss: {
      plugins: [tailwindcss],
    },
  },
})
