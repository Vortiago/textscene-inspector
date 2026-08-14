/**
 * AtlasTexture decode: the atlas ref → an image path, the region literal → the
 * window into it (and Godot's zero-region "whole image" rule).
 */
import { describe, it, expect } from 'vitest';
import { decodeAtlasTexture, parseAtlasRegion } from './decode';

describe('decodeAtlasTexture', () => {
  it('keeps the atlas ref raw and unwraps the region', () => {
    // The ref stays raw so the decode needs no resource table — that is what
    // keeps this module a leaf the shared Texture2D resolver can call.
    expect(decodeAtlasTexture({ atlas: 'ExtResource("2")', region: 'Rect2(32, 64, 16, 24)' })).toEqual({
      atlas: 'ExtResource("2")',
      region: { x: 32, y: 64, width: 16, height: 24 },
    });
  });

  it('keeps a raw res:// atlas ref as-is too', () => {
    expect(decodeAtlasTexture({ atlas: 'res://loose.png' })).toEqual({ atlas: 'res://loose.png' });
  });

  it('omits the region when the section declares none (the whole atlas)', () => {
    expect(decodeAtlasTexture({ atlas: 'ExtResource("2")' })).toEqual({ atlas: 'ExtResource("2")' });
  });

  it('reports a null atlas for an absent ref', () => {
    expect(decodeAtlasTexture({})).toEqual({ atlas: null });
  });

  it('keeps a decoded region even when the atlas ref is absent', () => {
    // The two answers are independent: a sheet that resolves later must not
    // silently widen the frame to the whole image in the meantime.
    expect(decodeAtlasTexture({ region: 'Rect2(0, 0, 8, 8)' })).toEqual({
      atlas: null,
      region: { x: 0, y: 0, width: 8, height: 8 },
    });
  });

  it('ignores a non-string atlas / region (a mis-typed property bag)', () => {
    expect(decodeAtlasTexture({ atlas: 7, region: 9 })).toEqual({ atlas: null });
  });
});

describe('parseAtlasRegion', () => {
  it('parses a Rect2, including negative offsets and the scientific notation Godot emits', () => {
    expect(parseAtlasRegion('Rect2(-4, -8, 16, 24)')).toEqual({ x: -4, y: -8, width: 16, height: 24 });
    expect(parseAtlasRegion('Rect2(1e-05, 0, 16, 16)')).toEqual({ x: 1e-5, y: 0, width: 16, height: 16 });
  });

  it('tolerates the whitespace Godot writes around components', () => {
    expect(parseAtlasRegion('Rect2( 0 , 0 , 16 , 16 )')).toEqual({ x: 0, y: 0, width: 16, height: 16 });
  });

  it('returns null for an absent or non-Rect2 value', () => {
    expect(parseAtlasRegion(undefined)).toBeNull();
    expect(parseAtlasRegion('')).toBeNull();
    expect(parseAtlasRegion('"0, 0, 16, 16"')).toBeNull();
    expect(parseAtlasRegion('Rect2(0, 0, 16)')).toBeNull();
  });

  it('REJECTS a malformed component instead of storing NaN (canonical float grammar)', () => {
    // The loose `[\d.eE+-]+` copy this replaces accepted all three and produced
    // a region whose x/width was NaN — an invisible frame, not a missing one.
    expect(parseAtlasRegion('Rect2(1.2.3, 0, 16, 16)')).toBeNull();
    expect(parseAtlasRegion('Rect2(+1, 0, 16, 16)')).toBeNull();
    expect(parseAtlasRegion('Rect2(.5, 0, 16, 16)')).toBeNull();
    expect(parseAtlasRegion('Rect2(--1, 0, 16, 16)')).toBeNull();
    expect(parseAtlasRegion('Rect2(0, 0, 16, 16) trailing-garbage')).toBeNull();
  });

  it('treats a zero or negative area as no region (Godot samples the whole atlas)', () => {
    expect(parseAtlasRegion('Rect2(0, 0, 0, 0)')).toBeNull();
    expect(parseAtlasRegion('Rect2(8, 8, 16, 0)')).toBeNull();
    expect(parseAtlasRegion('Rect2(8, 8, -16, 24)')).toBeNull();
  });
});
