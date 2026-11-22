import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // Test against the TypedRest sources in the parent directory rather than a build or a published release
    alias: [{ find: /^typedrest(\/.*)?$/, replacement: fileURLToPath(new URL('..', import.meta.url)) + '$1' }],
    // Prefer sources over build output that may sit next to them
    extensions: ['.ts', '.mjs', '.js', '.mts', '.jsx', '.tsx', '.json'],
  },
  test: {
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    setupFiles: ['./vitest.setup.ts'],
    // fetchMock.resetMocks() does not clear pending mockOnceIf() predicates, so reset all mocks between tests
    mockReset: true,
  },
});
