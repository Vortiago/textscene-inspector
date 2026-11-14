import { describe, expect, it } from 'vitest';
import { bytesView } from './bytesView';

describe('bytesView', () => {
  it('reads from the first byte of a subarray, not from the start of its buffer', () => {
    const view = bytesView(Uint8Array.of(1, 2, 3, 4).subarray(2));
    expect(view.byteLength).toBe(2);
    expect(view.getUint16(0)).toBe(0x0304);
  });
});
