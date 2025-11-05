/// <reference types="vitest/globals" />

/**
 * Test setup file for web app tests.
 * Configures global mocks and test environment.
 */

import { vi, afterEach } from 'vitest';

// Mock global fetch for tests
globalThis.fetch = vi.fn() as any;

// Mock console methods to reduce noise during tests
globalThis.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as Console;

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
