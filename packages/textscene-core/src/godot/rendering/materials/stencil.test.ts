import { describe, expect, it } from 'vitest';
import { StencilFlag, stencilFlagsAfterSet } from './stencil.js';

const { READ, WRITE, WRITE_DEPTH_FAIL } = StencilFlag;

describe('stencilFlagsAfterSet', () => {
  it('stores the requested flags when they do not mix read and write', () => {
    expect(stencilFlagsAfterSet(0, WRITE | WRITE_DEPTH_FAIL)).toBe(WRITE | WRITE_DEPTH_FAIL);
  });

  it('keeps only read when a fresh material asks for read and write at once', () => {
    expect(stencilFlagsAfterSet(0, READ | WRITE)).toBe(READ);
  });

  it('switches a writing material to read alone', () => {
    expect(stencilFlagsAfterSet(WRITE, READ | WRITE)).toBe(READ);
  });

  it('switches a reading material to write alone', () => {
    expect(stencilFlagsAfterSet(READ, READ | WRITE_DEPTH_FAIL)).toBe(WRITE_DEPTH_FAIL);
  });
});
