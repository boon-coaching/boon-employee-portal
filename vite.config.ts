import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const designSystemRoot = fileURLToPath(new URL('../boon-design-system', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
      '@boon/design-system': `${designSystemRoot}/components/index.ts`,
      '@boon/design-system/tokens': `${designSystemRoot}/tokens`,
    },
  },
  server: {
    port: 3000,
    host: true,
    fs: {
      // Allow Vite to serve files from the sibling design system repo
      allow: ['..'],
    },
  },
});
