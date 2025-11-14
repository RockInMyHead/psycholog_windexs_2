import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    server: {
      host: "::",
      port: 8080,
      // Полностью отключаем HMR в продакшене
      hmr: isProduction ? false : {
        port: 8080,
      },
      proxy: {
        '/api': {
          target: isProduction
            ? 'https://psycholog.windexs.ru'
            : 'http://localhost:3002',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path,
        },
      },
    },
    // Отключаем HMR порт в продакшене
    define: {
      ...(isProduction && {
        __HMR_PORT__: undefined,
        // Отключаем WebSocket подключения в продакшене
        'import.meta.env.VITE_DISABLE_HMR': 'true',
      }),
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
