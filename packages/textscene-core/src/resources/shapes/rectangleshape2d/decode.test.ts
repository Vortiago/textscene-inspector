/** Tests for the RectangleShape2D decode — canonical parseVector2 contract. */

import { describe, expect, it } from 'vitest';
import { decodeRectangleShape2D } from './decode';

describe('decodeRectangleShape2D', () => {
  it('honours a valid size', () => {
    expect(decodeRectangleShape2D({ size: 'Vector2(40, 60)' }).size).toEqual({ x: 40, y: 60 });
  });

  it('falls back to the Godot default {20,20} when size is absent', () => {
    expect(decodeRectangleShape2D({}).size).toEqual({ x: 20, y: 20 });
  });

  it('falls back to the {20,20} default for loose-regex-only garbage', () => {
    expect(decodeRectangleShape2D({ size: 'Vector2(--1, 2)' }).size).toEqual({ x: 20, y: 20 });
    expect(decodeRectangleShape2D({ size: 'Vector2(1e-, 2)' }).size).toEqual({ x: 20, y: 20 });
  });
});

describe('decodeRectangleShape2D negative size', () => {
  it('refuses the whole size when either component is negative (rectangle_shape_2d.cpp:61)', () => {
    expect(decodeRectangleShape2D({ size: 'Vector2(-40, 60)' }).size).toEqual({ x: 20, y: 20 });
    expect(decodeRectangleShape2D({ size: 'Vector2(0, 0)' }).size).toEqual({ x: 0, y: 0 });
  });
});
