/**
 * `textureState`: what a canvas mesh texture slot holds, from the loader's report and the view.
 */
import { describe, expect, it } from 'vitest';
import { textureState } from './canvasMeshTextureState';

const NOTHING = { missing: false, hasView: false, isArriving: false, hasSource: false };

describe('textureState', () => {
  it('is none for a slot that names no texture', () => {
    expect(textureState(NOTHING)).toBe('none');
  });

  it('is ready once a view is here', () => {
    expect(textureState({ ...NOTHING, hasSource: true, hasView: true })).toBe('ready');
  });

  it('is arriving while the loader reports the texture in flight', () => {
    expect(textureState({ ...NOTHING, isArriving: true })).toBe('arriving');
  });

  it('is arriving for a texture the loader holds before its view is uploaded', () => {
    expect(textureState({ ...NOTHING, hasSource: true })).toBe('arriving');
  });

  it('is missing for a failed texture, whatever else holds', () => {
    expect(textureState({ missing: true, hasView: true, isArriving: true, hasSource: true })).toBe('missing');
  });
});
