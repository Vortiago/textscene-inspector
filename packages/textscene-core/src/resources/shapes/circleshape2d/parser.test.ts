/** Tests for CircleShape2D parser. */

import { describe, expect, it } from 'vitest';
import { parseCircleShape2D } from './parser';

describe('parseCircleShape2D', () => {
  it('honours a valid radius', () => {
    expect(parseCircleShape2D({ radius: '25' }).radius).toBe(25);
  });

  it('falls back to the Godot default (10) when radius is absent', () => {
    expect(parseCircleShape2D({}).radius).toBe(10);
  });

  it('falls back to the default (10) for a malformed radius', () => {
    expect(parseCircleShape2D({ radius: 'not-a-number' }).radius).toBe(10);
  });
});
