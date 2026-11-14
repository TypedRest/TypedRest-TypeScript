import createFetchMock from 'vitest-fetch-mock';
import { vi } from 'vitest';

// Replaces global fetch() with a mock, exposed as the global `fetchMock`
createFetchMock(vi).enableMocks();
