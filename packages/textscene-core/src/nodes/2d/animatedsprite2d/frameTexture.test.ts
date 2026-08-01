/**
 * resolveFrameTexture: turns a SpriteFrames frame `texture` ref into a concrete
 * source-image path (+ optional atlas sub-region), resolving against whichever
 * resource pools own the SpriteFrames (the scene's, or an external .tres's).
 */
import { describe, it, expect } from 'vitest';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import { resolveFrameTexture } from './frameTexture';

const EXT: TscnExternalResource[] = [
  { id: '2', type: 'Texture2D', path: 'res://atlas.png' },
  { id: '5', type: 'Texture2D', path: 'res://frame.png' },
];

const ATLAS_SUB: TscnInternalResource = {
  id: 'AtlasTexture_0ik14',
  type: 'AtlasTexture',
  data: { atlas: 'ExtResource("2")', region: 'Rect2(32, 64, 16, 24)', id: 'AtlasTexture_0ik14' },
};

describe('resolveFrameTexture', () => {
  it('resolves an ExtResource frame to its texture path (no region)', () => {
    const r = resolveFrameTexture('ExtResource("5")', [], EXT);
    expect(r).toEqual({ path: 'res://frame.png' });
  });

  it('resolves a SubResource AtlasTexture to the atlas path + region', () => {
    const r = resolveFrameTexture('SubResource("AtlasTexture_0ik14")', [ATLAS_SUB], EXT);
    expect(r).toEqual({
      path: 'res://atlas.png',
      region: { x: 32, y: 64, width: 16, height: 24 },
    });
  });

  it('passes a raw res:// path through unchanged', () => {
    const r = resolveFrameTexture('res://loose.png', [], EXT);
    expect(r).toEqual({ path: 'res://loose.png' });
  });

  it('returns a null path for an ExtResource id that is not registered', () => {
    const r = resolveFrameTexture('ExtResource("99")', [], EXT);
    expect(r).toEqual({ path: null });
  });

  it('returns a null path for a SubResource that is missing', () => {
    const r = resolveFrameTexture('SubResource("nope")', [ATLAS_SUB], EXT);
    expect(r).toEqual({ path: null });
  });

  it('returns a null path for a non-AtlasTexture SubResource', () => {
    const other: TscnInternalResource = { id: 's', type: 'GradientTexture2D', data: { id: 's' } };
    const r = resolveFrameTexture('SubResource("s")', [other], EXT);
    expect(r).toEqual({ path: null });
  });

  it('yields the atlas path with no region when the AtlasTexture omits a valid region', () => {
    const noRegion: TscnInternalResource = {
      id: 'a',
      type: 'AtlasTexture',
      data: { atlas: 'ExtResource("2")', id: 'a' },
    };
    const r = resolveFrameTexture('SubResource("a")', [noRegion], EXT);
    expect(r).toEqual({ path: 'res://atlas.png' });
  });

  it('delegates the region to the AtlasTexture decode, which rejects a malformed Rect2', () => {
    const bad: TscnInternalResource = {
      id: 'b',
      type: 'AtlasTexture',
      data: { atlas: 'ExtResource("2")', region: 'Rect2(1.2.3, 0, 16, 16)', id: 'b' },
    };
    // No NaN-windowed (invisible) frame: an unparseable region samples the sheet.
    expect(resolveFrameTexture('SubResource("b")', [bad], EXT)).toEqual({ path: 'res://atlas.png' });
  });

  it('returns a null path for a null/empty ref', () => {
    expect(resolveFrameTexture(null, [], EXT)).toEqual({ path: null });
    expect(resolveFrameTexture('', [], EXT)).toEqual({ path: null });
  });
});
