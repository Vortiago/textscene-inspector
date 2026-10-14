/**
 * The slice's routing claim, for a standalone `.tres`. A NoiseTexture3D generates its own texels,
 * so nothing is fetched for an inline one.
 */
import { describe, expect, it } from 'vitest';
import './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

describe('noisetexture3d slice registration', () => {
  it('claims the NoiseTexture3D type name for the resource bus slot', () => {
    expect(resourceSliceRegistry.byTypeName('NoiseTexture3D')).toMatchObject({
      slice: 'noisetexture3d',
      kind: 'godot-text',
      busType: 'resource',
    });
  });

  it('claims no file extension, since the texels are generated, never loaded', () => {
    expect(resourceSliceRegistry.byTypeName('NoiseTexture3D')!.extensions).toBeUndefined();
  });
});
