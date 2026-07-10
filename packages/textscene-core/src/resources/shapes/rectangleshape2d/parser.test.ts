/** Tests for RectangleShape2D parser — canonical parseVector2 contract. */

import { describe, expect, it } from 'vitest';
import { parseRectangleShape2D } from './parser';

describe('parseRectangleShape2D', () => {
  it('honours a valid size', () => {
    expect(parseRectangleShape2D({ size: 'Vector2(40, 60)' }).size).toEqual({ x: 40, y: 60 });
  });

  it('falls back to the Godot default {20,20} when size is absent', () => {
    expect(parseRectangleShape2D({}).size).toEqual({ x: 20, y: 20 });
  });

  it('falls back to the {20,20} default for loose-regex-only garbage', () => {
    expect(parseRectangleShape2D({ size: 'Vector2(--1, 2)' }).size).toEqual({ x: 20, y: 20 });
    expect(parseRectangleShape2D({ size: 'Vector2(1e-, 2)' }).size).toEqual({ x: 20, y: 20 });
  });
});
