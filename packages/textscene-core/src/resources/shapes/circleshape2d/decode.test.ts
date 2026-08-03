/** Tests for the CircleShape2D decode. */

import { describe, expect, it } from 'vitest';
import { decodeCircleShape2D } from './decode';

describe('decodeCircleShape2D', () => {
  it('honours a valid radius', () => {
    expect(decodeCircleShape2D({ radius: '25' }).radius).toBe(25);
  });

  it('falls back to the Godot default (10) when radius is absent', () => {
    expect(decodeCircleShape2D({}).radius).toBe(10);
  });

  it('falls back to the default (10) for a malformed radius', () => {
    expect(decodeCircleShape2D({ radius: 'not-a-number' }).radius).toBe(10);
  });
});

describe('decodeCircleShape2D negative radius', () => {
  it('refuses a negative radius the way Godot ERR_FAILs it (circle_shape_2d.cpp:46)', () => {
    expect(decodeCircleShape2D({ radius: '-25' }).radius).toBe(10);
  });
});
