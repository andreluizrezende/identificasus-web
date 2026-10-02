import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

/**
 * Console da Central de Regulação: roda em computador, com rede. Sem PWA e sem
 * modo offline — ao contrário do app de campo, aqui não há o que capturar sem
 * rede, e um cache de dado de caso no navegador de uma estação compartilhada
 * seria só risco.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // 5173 é do identificasus-app: os dois rodam lado a lado em desenvolvimento.
    port: 5174,
    host: true,
    // (!) PROXY EM VEZ DE CORS, como no app. Em produção o vercel.json repassa
    //     /api para o backend na mesma origem; aqui o Vite faz o mesmo.
    proxy: {
      '/api': {
        target: process.env.VITE_API_ALVO ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
