import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 指向源码，改动组件库后可立即在演示页热更新。
      '@kpro/react': fileURLToPath(new URL('../../packages/react/src/index.ts', import.meta.url)),
      '@kpro/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    open: true,
  },
});
