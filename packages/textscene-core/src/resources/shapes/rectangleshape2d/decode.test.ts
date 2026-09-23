/** Tests for the RectangleShape2D decode: the canonical parseVector2 contract. */

import { describe, expect, it } from 'vitest';
import { decodeRectangleShape2D } from './decode';
import { canonicalisePropertyBag } from '../../../godot/deprecated';

describe('decodeRectangleShape2D', () => {
  it('honours a valid size', () => {
    expect(decodeRectangleShape2D({ size: 'Vector2(40, 60)' }).size).toEqual({ x: 40, y: 60 });
  });

  it('falls back to the Godot default {20,20} when size is absent', () => {
    expect(decodeRectangleShape2D({}).size).toEqual({ x: 20, y: 20 });
  });

  it('falls back to the {20,20} default for loose-regex-only garbage', () => {
    expect(decodeRectangleShape2D({ size: 'Vector2(--1, 2)' }).size).toEqual({ x: 20, y: 20 });
    expect(decodeRectangleShape2D({ size: 'Vector2(+1, 2)' }).size).toEqual({ x: 20, y: 20 });
  });
});

describe('decodeRectangleShape2D negative size', () => {
  it('refuses the whole size when either component is negative (rectangle_shape_2d.cpp:61)', () => {
    expect(decodeRectangleShape2D({ size: 'Vector2(-40, 60)' }).size).toEqual({ x: 20, y: 20 });
    expect(decodeRectangleShape2D({ size: 'Vector2(0, 0)' }).size).toEqual({ x: 0, y: 0 });
  });
});

describe('decodeRectangleShape2D on a Godot-3 extents', () => {
  it('reads the doubled size the scan resolved (rectangle_shape_2d.cpp:42-44)', () => {
    expect(
      decodeRectangleShape2D(canonicalisePropertyBag('RectangleShape2D', { extents: 'Vector2(16, 8)' })).size
    ).toEqual({ x: 32, y: 16 });
    expect(decodeRectangleShape2D({ extents: 'Vector2(16, 8)' }).size).toEqual({ x: 20, y: 20 });
  });
});
