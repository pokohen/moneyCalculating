import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const page = (path) => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  // 상대 경로로 빌드해서 어떤 정적 호스팅에 올려도 그대로 동작하게 한다.
  base: './',
  plugins: [vue()],
  build: {
    // 언어마다 HTML을 따로 뽑는다. GitHub Pages에는 rewrite가 없어서
    // /ja/ 가 진짜 파일로 있어야 주소로 바로 들어갈 수 있다.
    rollupOptions: {
      input: {
        ko: page('index.html'),
        ja: page('ja/index.html'),
        en: page('en/index.html'),
      },
    },
  },
  server: {
    host: true, // 같은 와이파이의 휴대폰에서 바로 열어볼 수 있게
  },
})
