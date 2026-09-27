/**
 * The one order the toolbar's error channels share: each error takes its place when it is set.
 */

import { describe, expect, it } from 'vitest';
import { nextErrorSequence, sequencedError } from './errorSequence';

describe('nextErrorSequence', () => {
  it('rises with every call', () => {
    const first = nextErrorSequence();
    const second = nextErrorSequence();
    expect(second).toBeGreaterThan(first);
  });
});

describe('sequencedError', () => {
  it('carries the message, newer than every sequence taken before it', () => {
    const before = nextErrorSequence();
    const error = sequencedError('Failed to load fixture: Not Found');
    expect(error.message).toBe('Failed to load fixture: Not Found');
    expect(error.sequence).toBeGreaterThan(before);
  });

  it('gives a repeated message its own place, so a retry that fails again is the newest', () => {
    const first = sequencedError('Failed to load fixture: Not Found');
    const retry = sequencedError('Failed to load fixture: Not Found');
    expect(retry.sequence).toBeGreaterThan(first.sequence);
  });
});
