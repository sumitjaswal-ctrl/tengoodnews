import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps every asset and data path relative, so the same build works on a custom domain
// or under a GitHub Pages project path (https://user.github.io/repo/).
export default defineConfig({
  base: './',
  plugins: [react()],
})
