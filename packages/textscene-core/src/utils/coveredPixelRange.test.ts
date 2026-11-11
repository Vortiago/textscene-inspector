import { describe, it, expect } from 'vitest';
import { coveredPixelRange } from './coveredPixelRange';

describe('coveredPixelRange', () => {
  it('takes the pixels whose centres lie in [from, to)', () => {
    expect(coveredPixelRange(2.5, 5.5)).toEqual({ first: 2, last: 4 });
  });

  it('covers a centre on the left end and not one on the right end', () => {
    expect(coveredPixelRange(2.5, 3.5)).toEqual({ first: 2, last: 2 });
  });

  it('covers no pixel when both ends lie between the same two centres', () => {
    const { first, last } = coveredPixelRange(3.6, 4.4);
    expect(last).toBeLessThan(first);
  });
});
