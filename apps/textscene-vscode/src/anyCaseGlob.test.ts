import { describe, expect, it } from 'vitest';
import { anyCase } from './anyCaseGlob';

describe('anyCase', () => {
  it('gives each letter a class of both cases, and keeps any other character', () => {
    expect(anyCase('glb')).toBe('[gG][lL][bB]');
    expect(anyCase('mp3')).toBe('[mM][pP]3');
  });
});
