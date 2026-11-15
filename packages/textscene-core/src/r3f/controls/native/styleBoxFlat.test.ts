import { describe, expect, it } from 'vitest';
import { contentRect, flatStyleBox } from './styleBoxFlat';

const BOX = flatStyleBox(
  { r: 0, g: 0, b: 0, a: 1 },
  { contentMargin: { left: 4, top: 2, right: 6, bottom: 8 } }
);

describe('contentRect', () => {
  it('insets the rect by each content margin', () => {
    expect(contentRect({ x: 10, y: 20, w: 100, h: 50 }, BOX)).toEqual({ x: 14, y: 22, w: 90, h: 40 });
  });

  it('keeps the rect for a box with no margins', () => {
    const plain = flatStyleBox({ r: 0, g: 0, b: 0, a: 1 });
    expect(contentRect({ x: 1, y: 2, w: 3, h: 4 }, plain)).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it('goes negative when the margins exceed the rect, as Godot does', () => {
    expect(contentRect({ x: 0, y: 0, w: 5, h: 5 }, BOX)).toEqual({ x: 4, y: 2, w: -5, h: -5 });
  });
});

describe('flatStyleBox corner detail', () => {
  const black = { r: 0, g: 0, b: 0, a: 1 };

  it('keeps the StyleBoxFlat default of 8 when no detail is given', () => {
    expect(flatStyleBox(black).cornerDetail).toBe(8);
  });

  it('writes the detail it is given', () => {
    expect(flatStyleBox(black, { cornerDetail: 5 }).cornerDetail).toBe(5);
  });
});
