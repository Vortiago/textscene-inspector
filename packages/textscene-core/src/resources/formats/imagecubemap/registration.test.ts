import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../../sliceRegistration';
import '../image/index';
import './index';

describe('imagecubemap slice registration', () => {
  it('claims CompressedCubemap for the cubemap bus slot', () => {
    expect(resourceSliceRegistry.byTypeName('CompressedCubemap')?.busType).toBe('cubemap');
  });

  it('leaves the image extensions to the image slice', () => {
    expect(resourceSliceRegistry.byExtension('.webp')?.slice).toBe('image');
  });
});
