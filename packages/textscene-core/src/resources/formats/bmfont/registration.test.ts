/** The BMFont slice's routing claims (ADR-0031): the extensions are the whole claim. */

import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../../sliceRegistration';
import { isBinaryResourceType } from '../../resourceProviderUtils';
import { isBmfontPath } from './extensions';
import './index';

describe('bmfont slice registration', () => {
  it('claims both importer extensions, as bytes, on the font bus slot', () => {
    for (const extension of ['.fnt', '.font']) {
      const registration = resourceSliceRegistry.byExtension(extension);
      expect(registration?.slice).toBe('bmfont');
      expect(registration?.kind).toBe('foreign-format');
      expect(registration?.binaryBytes).toBe(true);
      expect(registration?.busType).toBe('font');
      expect(isBinaryResourceType('Unknown', `res://fonts/face${extension}`)).toBe(true);
    }
  });

  it('claims no type name, as a FontFile ExtResource often names a text wrapper', () => {
    expect(resourceSliceRegistry.byExtension('.fnt')?.typeNames).toEqual([]);
  });

  it('reads a descriptor path whatever its case', () => {
    expect(isBmfontPath('res://fonts/Hero.FNT')).toBe(true);
    expect(isBmfontPath('res://fonts/hero.ttf')).toBe(false);
  });
});
