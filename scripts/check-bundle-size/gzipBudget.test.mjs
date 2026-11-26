import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportGzipBudget } from './gzipBudget.mjs';

const CEILING = { measured: 900, budget: 1000 };

describe('reportGzipBudget', () => {
  beforeEach(() => {
    for (const level of ['log', 'warn', 'error']) vi.spyOn(console, level).mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('passes a size at the ceiling', () => {
    expect(reportGzipBudget('script', { gz: 1000 }, CEILING, true)).toBe(false);
  });

  it('reports a size over the ceiling as an error when enforced', () => {
    expect(reportGzipBudget('script', { gz: 1001 }, CEILING, true)).toBe(true);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('reports a size over the ceiling as a warning when not enforced', () => {
    expect(reportGzipBudget('script', { gz: 1001 }, CEILING, false)).toBe(true);
    expect(console.warn).toHaveBeenCalledOnce();
  });
});
