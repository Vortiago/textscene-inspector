/**
 * The image3d slice's routing claims (ADR-0031). Importing the index registers them, and these
 * assertions are what a router reads back out.
 */
import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../../sliceRegistration';
import '../image/index';
import './index';

describe('image3d slice registration', () => {
  it('claims CompressedTexture3D for the texture3d bus slot', () => {
    const registration = resourceSliceRegistry.byTypeName('CompressedTexture3D');
    expect(registration?.slice).toBe('image3d');
    expect(registration?.kind).toBe('foreign-format');
    expect(registration?.busType).toBe('texture3d');
  });

  it('leaves the image extensions to the image slice, which fetches them as bytes', () => {
    expect(resourceSliceRegistry.byExtension('.png')?.slice).toBe('image');
  });

  it('claims no Texture3D a scene names by another type (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('ImageTexture3D')).toBeNull();
  });
});
