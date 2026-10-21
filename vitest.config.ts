import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'scripts/**/*.ts'],
      exclude: [
        'src/test-setup.ts',
        'src/main.tsx',
        'src/sw.ts',
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
      ],
    },
  },
});
