import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// npm run build       → dist/       실사용판 (Cloudflare Pages + D1)
// npm run build:demo  → dist-demo/  체험판 (서버 없음, index.html을 바로 열어도 동작)
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist', emptyOutDir: true },
}));
