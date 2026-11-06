import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Относительные пути, чтобы сайт работал на GitHub Pages по адресу /имя-репозитория/
  base: './',
})
