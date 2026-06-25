import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    globals: false,
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/lib/**/*.ts', 'src/tools/**/codecs.ts'],
    },
  },
});
