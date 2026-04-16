import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss()
  ],
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: {
        chrome: 109 << 16,
      },
    },
  },
  build: {
    cssMinify: 'lightningcss',
    target: ['chrome109', 'edge109', 'firefox109', 'safari15'],
  },
  esbuild: {
    target: 'chrome109',
  },
})
