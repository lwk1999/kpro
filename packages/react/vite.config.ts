import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      exclude: ['src/**/*.test.tsx'],
      // 以 src 为入口根，产物落到 dist/types/*.d.ts，与 package.json 的 types 字段对应。
      entryRoot: 'src',
      outDir: 'dist/types',
      // 保留 `@kpro/core` 裸模块说明符，避免声明文件里写死指向源码的相对路径。
      pathsToAliases: false,
      skipDiagnostics: true,
    }),
  ],
  resolve: {
    alias: {
      // 开发态直接指向 core 源码，保证与 monorepo 内其它包始终一致。
      '@kpro/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'KProReact',
      formats: ['es', 'cjs'],
      fileName: (format) => (format === 'es' ? 'index.js' : 'index.cjs'),
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', '@kpro/core'],
    },
    sourcemap: true,
    minify: false,
    emptyOutDir: true,
  },
});