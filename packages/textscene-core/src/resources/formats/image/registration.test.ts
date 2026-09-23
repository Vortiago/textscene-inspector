/**
 * The image slice's routing claims (ADR-0031). Importing the index registers them, and
 * these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { registerResourceSlice, resourceSliceRegistry } from '../../sliceRegistration';
import './index';

describe('image slice registration', () => {
  it('claims the imported-image type names for the texture bus slot', () => {
    for (const typeName of ['Texture2D', 'CompressedTexture2D', 'ImageTexture']) {
      const registration = resourceSliceRegistry.byTypeName(typeName);
      expect(registration?.slice).toBe('image');
      expect(registration?.kind).toBe('foreign-format');
      expect(resourceSliceRegistry.busTypeFor(typeName)).toBe('texture');
    }
  });

  it('claims every extension the image decoder handles, as bytes', () => {
    for (const extension of ['.png', '.jpg', '.jpeg', '.webp', '.svg']) {
      const registration = resourceSliceRegistry.byExtension(extension);
      expect(registration?.slice).toBe('image');
      expect(registration?.binaryBytes).toBe(true);
    }
  });

  it('labels a failed load the way the missing-resources panel reads it', () => {
    expect(resourceSliceRegistry.byTypeName('Texture2D')?.failureLabel).toBe(
      'Material using texture'
    );
  });

  it('does not claim an image format the decoder has no path for', () => {
    // .tga/.bmp are legal Godot imports. Nothing here decodes them, so a claim would
    // route them to a processor that then refuses them.
    expect(resourceSliceRegistry.byExtension('.tga')).toBeNull();
    expect(resourceSliceRegistry.byExtension('.bmp')).toBeNull();
  });

  it('rejects a second slice claiming Texture2D', () => {
    expect(() =>
      registerResourceSlice({
        slice: 'not-image',
        kind: 'godot-text',
        typeNames: ['Texture2D'],
        busType: null,
        failureLabel: 'Impostor',
      })
    ).toThrow(/already claimed by slice "image"/);
  });
});
