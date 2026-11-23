import { defineConfig } from 'vite';

export default defineConfig({
  server: { open: false },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    passWithNoTests: true,
  },
});
