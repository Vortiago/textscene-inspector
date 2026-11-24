import { describe, expect, it } from 'vitest';
import { unpremultiplyAlpha } from './unpremultiplyAlpha';

const unpremultiplied = (...rgba: number[]) => {
  const data = new Uint8Array(rgba);
  unpremultiplyAlpha(data);
  return [...data];
};

describe('unpremultiplyAlpha', () => {
  it('divides the colour of a partly clear pixel by its alpha', () => {
    expect(unpremultiplied(64, 32, 0, 128)).toEqual([128, 64, 0, 128]);
  });

  it('keeps an opaque pixel and a clear pixel as they are', () => {
    expect(unpremultiplied(10, 20, 30, 255, 1, 2, 3, 0)).toEqual([10, 20, 30, 255, 1, 2, 3, 0]);
  });

  it('caps a colour above its alpha at 255', () => {
    expect(unpremultiplied(200, 0, 0, 100)).toEqual([255, 0, 0, 100]);
  });
});
