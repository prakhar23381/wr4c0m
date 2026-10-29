import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // In development the FastAPI backend runs separately on :8000.
    proxy: { '/api': 'http://localhost:8000' },
  },
  build: {
    // The ECharts chunk (~190 kB gzipped) is expected to be large.
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        // Charting is most of the bundle and changes rarely: give it its own cacheable chunk.
        codeSplitting: {
          groups: [{ name: 'echarts', test: /node_modules[\\/](echarts|zrender)[\\/]/ }],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
