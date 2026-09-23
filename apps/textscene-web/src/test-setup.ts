/// <reference types="vitest/globals" />

/** Global setup for the web app's tests: a mocked fetch and console, reset after each test. */

import { vi, afterEach } from 'vitest';

globalThis.fetch = vi.fn() as any;

// Mocked to keep the test output quiet.
globalThis.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as Console;

afterEach(() => {
  vi.clearAllMocks();
});
