import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // 指向源码，改动组件库后可立即在演示页热更新。
      '@kpro/vue': fileURLToPath(new URL('../../packages/vue/src/index.ts', import.meta.url)),
      '@kpro/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
