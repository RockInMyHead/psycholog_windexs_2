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
    host: true, // Разрешить доступ из сети
    https: process.env.USE_HTTPS === 'true' ? {
      key: './server/key.pem',
      cert: './server/cert.pem',
    } : false,
    // Настраиваем proxy - используем production URL
    proxy: {
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
