import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Evita que se carguen dos copias de React (invalid hook call)
    dedupe: ['react', 'react-dom'],
  },
})
