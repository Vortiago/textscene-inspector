/**
 * Test setup file for web app tests.
 * Configures global mocks and test environment.
 */

import { vi } from 'vitest';

// Mock global fetch for tests
global.fetch = vi.fn();

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Reset mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});
