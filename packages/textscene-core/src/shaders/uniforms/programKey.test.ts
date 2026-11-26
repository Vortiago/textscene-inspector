import { describe, expect, it } from 'vitest';
import { textHash } from './programKey';

describe('textHash', () => {
  it('is one hash for one text', () => {
    expect(textHash('shader_type spatial;')).toBe(textHash('shader_type spatial;'));
  });

  it('differs for a text one character apart', () => {
    expect(textHash('ALBEDO = vec3(0.6);')).not.toBe(textHash('ALBEDO = vec3(0.5);'));
  });
});
