import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // 상대 경로로 빌드해서 어떤 정적 호스팅에 올려도 그대로 동작하게 한다.
  base: './',
  plugins: [vue()],
  server: {
    host: true, // 같은 와이파이의 휴대폰에서 바로 열어볼 수 있게
  },
})
