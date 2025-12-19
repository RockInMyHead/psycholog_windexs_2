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
    allowedHosts: ['.ngrok-free.dev', '.ngrok.app'], // Разрешить ngrok хосты
    https: process.env.USE_HTTPS === 'true' ? {
      key: './server/key.pem',
      cert: './server/cert.pem',
    } : false,
    // Настраиваем proxy - для разработки используем локальный сервер
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'production' 
          ? 'https://psycholog.windexs.ru' 
          : 'http://localhost:1033',
        changeOrigin: true,
        secure: false, // false для локальной разработки
        ws: true, // поддержка WebSocket
      },
      '/health': {
        target: process.env.NODE_ENV === 'production' 
          ? 'https://psycholog.windexs.ru' 
          : 'http://localhost:1033',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  define: mode === 'production' ? {
    // Полностью отключаем development режим для production
    __HMR_PORT__: undefined,
    'import.meta.env.VITE_DISABLE_HMR': 'true',
  } : {},
}));
