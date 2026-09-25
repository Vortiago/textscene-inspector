/**
 * The slice's routing claim, for a standalone `.tres`. A NoiseTexture2D generates
 * its own pixels, so nothing is fetched for an inline one.
 */
import { describe, expect, it } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('noisetexture2d slice registration', () => {
  it('claims the NoiseTexture2D type name', () => {
    expect(resourceSliceRegistry.byTypeName('NoiseTexture2D')).toMatchObject({
      slice: 'noisetexture2d',
      kind: 'godot-text',
      busType: 'resource',
      failureLabel: 'Resource',
    });
  });

  it('routes NoiseTexture2D to the resource bus slot', () => {
    expect(resourceSliceRegistry.busTypeFor('NoiseTexture2D')).toBe('resource');
  });

  it('claims no file extension — the pixels are generated, never loaded', () => {
    expect(resourceSliceRegistry.byTypeName('NoiseTexture2D')!.extensions).toBeUndefined();
  });
});
