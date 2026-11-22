import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', 'query/**'],
    setupFiles: ['./vitest.setup.ts'],
    // fetchMock.resetMocks() does not clear pending mockOnceIf() predicates, so reset all mocks between tests
    mockReset: true,
  },
});
