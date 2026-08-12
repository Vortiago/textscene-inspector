/**
 * The dynamic-font-container slice's routing claims (ADR-0031). Importing the
 * index registers them; these assertions are what a router reads back out.
 */

import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../../sliceRegistration';
import { isBinaryResourceType } from '../../resourceProviderUtils';
import './index';

describe('dynamicfont slice registration', () => {
  it('claims every raw font container extension, as bytes, on the font bus slot', () => {
    for (const extension of ['.ttf', '.otf', '.woff', '.woff2']) {
      const registration = resourceSliceRegistry.byExtension(extension);
      expect(registration?.slice).toBe('dynamicfont');
      expect(registration?.kind).toBe('foreign-format');
      expect(registration?.binaryBytes).toBe(true);
      expect(registration?.busType).toBe('font');
      expect(registration?.failureLabel).toBe('Node using font');
      expect(isBinaryResourceType('Unknown', `res://fonts/face${extension}`)).toBe(true);
    }
  });

  it('claims NO type name — the binary signal is the extension alone', () => {
    // Splitting the claims is what keeps this true. A `FontFile` ExtResource
    // just as often names a text `.tres` wrapper — one carrying `fallbacks`
    // rather than font bytes of its own — and fetching that as bytes yields a
    // string no parser can read. Adding `FontFile` to this slice's `typeNames`
    // is exactly how that regression comes back.
    expect(resourceSliceRegistry.byExtension('.ttf')?.typeNames).toEqual([]);
    expect(resourceSliceRegistry.byTypeName('FontFile')?.slice).toBe('font');
    expect(isBinaryResourceType('FontFile')).toBe(false);
  });

  it('leaves the container formats no browser can decode unclaimed', () => {
    // Godot's own dynamic-font importer also recognises these
    // (`resource_importer_dynamic_font.cpp:47-58`); `FontFace` does not, so a
    // claim would promise bytes nothing can turn into a drawable face.
    for (const extension of ['.ttc', '.otc', '.pfb', '.pfm']) {
      expect(resourceSliceRegistry.byExtension(extension)).toBeNull();
    }
  });
});
