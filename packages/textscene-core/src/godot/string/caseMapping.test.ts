import { describe, expect, it } from 'vitest';
import { findLower, findUpper } from './caseMapping';

describe('findUpper', () => {
  it('maps ASCII and Latin-1 letters', () => {
    expect([0x61, 0x7a, 0xe9, 0x41].map(findUpper)).toEqual([0x41, 0x5a, 0xc9, 0x41]);
  });

  it('maps an alternating Latin pair and keeps the code between two pairs', () => {
    expect([0x101, 0x103, 0x100].map(findUpper)).toEqual([0x100, 0x102, 0x100]);
  });

  it('maps a Greek letter with iota subscript as ucaps.h does, not as Unicode full case does', () => {
    expect(findUpper(0x1f80)).toBe(0x1f88);
  });
});

describe('findLower', () => {
  it('maps the dotted capital I to a plain i', () => {
    expect(findLower(0x130)).toBe(0x69);
  });

  it('keeps a code no run holds', () => {
    expect([0x30, 0x1f600].map(findLower)).toEqual([0x30, 0x1f600]);
  });
});
