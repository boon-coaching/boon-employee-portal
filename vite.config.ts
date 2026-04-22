import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const designSystemRoot = fileURLToPath(new URL('../boon-design-system', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Order matters: most specific first, exact bare-name last.
      // Using regex form so longest-prefix match wins rather than first-registered.
      {
        find: /^@boon\/design-system\/tokens\/(.*)$/,
        replacement: `${designSystemRoot}/tokens/$1`,
      },
      {
        find: /^@boon\/design-system$/,
        replacement: `${designSystemRoot}/components/index.ts`,
      },
      { find: '@', replacement: '/src' },
    ],
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
