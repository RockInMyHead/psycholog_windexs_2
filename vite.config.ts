import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Production-only build configuration
export default defineConfig({
  build: {
    // Оптимизации для production
    minify: 'esbuild',
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Отключаем HMR для production сборки
  server: {
    hmr: false,
  },
  define: {
    // Полностью отключаем development режим
    __HMR_PORT__: undefined,
    'import.meta.env.VITE_DISABLE_HMR': 'true',
  },
});
