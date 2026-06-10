import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Moby dashboard — client-only animated command center.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
});
