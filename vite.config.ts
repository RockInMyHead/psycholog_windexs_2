import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => ({
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
  server: {
    port: 5173,
    // Настраиваем proxy в зависимости от режима
    proxy: mode === 'development' ? {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: 'http://localhost:3002',
        changeOrigin: true,
        secure: false,
      },
    } : {
      '/api': {
        target: 'https://psycholog.windexs.ru',
        changeOrigin: true,
        secure: true,
      },
      '/health': {
        target: 'https://psycholog.windexs.ru',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  define: mode === 'production' ? {
    // Полностью отключаем development режим для production
    __HMR_PORT__: undefined,
    'import.meta.env.VITE_DISABLE_HMR': 'true',
  } : {},
}));
