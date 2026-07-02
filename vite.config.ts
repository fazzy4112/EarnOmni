import { defineConfig } from "vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import viteTs from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    viteTs(),
  ],
})
