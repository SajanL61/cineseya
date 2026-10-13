import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDirectory = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: { alias: { '@': path.resolve(rootDirectory, 'src'), 'server-only': path.resolve(rootDirectory, 'tests/server-only.ts') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30000 },
});
