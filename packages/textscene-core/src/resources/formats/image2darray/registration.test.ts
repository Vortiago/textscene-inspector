/**
 * The image2darray slice's routing claims (ADR-0031). Importing the index registers them, and these
 * assertions are what a router reads back out.
 */
import { describe, expect, it } from 'vitest';
import { isBinaryResourceType } from '../../resourceProviderUtils';
import { resourceSliceRegistry } from '../../sliceRegistration';
import './index';

describe('image2darray slice registration', () => {
  it('claims CompressedTexture2DArray for the texture2darray bus slot', () => {
    const registration = resourceSliceRegistry.byTypeName('CompressedTexture2DArray');
    expect(registration?.slice).toBe('image2darray');
    expect(registration?.kind).toBe('foreign-format');
    expect(registration?.busType).toBe('texture2darray');
  });

  it('fetches the OpenEXR atlas a lightmap bake saves as bytes', () => {
    expect(resourceSliceRegistry.byExtension('.exr')?.slice).toBe('image2darray');
    expect(isBinaryResourceType('CompressedTexture2DArray', 'res://scene.exr')).toBe(true);
  });

  it('claims no texture array a scene names by another type (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('Texture2DArray')).toBeNull();
  });
});
