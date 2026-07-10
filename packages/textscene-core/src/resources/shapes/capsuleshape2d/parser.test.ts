/** Tests for CapsuleShape2D parser. */

import { describe, expect, it } from 'vitest';
import { parseCapsuleShape2D } from './parser';

describe('parseCapsuleShape2D', () => {
  it('honours valid radius and height', () => {
    const result = parseCapsuleShape2D({ radius: '15', height: '40' });
    expect(result.radius).toBe(15);
    expect(result.height).toBe(40);
  });

  it('falls back to Godot defaults (radius 10, height 30) when absent', () => {
    const result = parseCapsuleShape2D({});
    expect(result.radius).toBe(10);
    expect(result.height).toBe(30);
  });

  it('falls back to defaults for malformed values', () => {
    const result = parseCapsuleShape2D({ radius: 'nope', height: 'nope' });
    expect(result.radius).toBe(10);
    expect(result.height).toBe(30);
  });
});
