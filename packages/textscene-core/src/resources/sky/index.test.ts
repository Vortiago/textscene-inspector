import { describe, expect, it } from 'vitest';
import * as skySlice from './index';
import { decodeSkyMaterial } from './decode';
import { resourceSliceRegistry } from '../sliceRegistration';

// Importing the entry point is what registers the claims; the assertions read the
// registry by name, never `all()` — that array's contents depend on which other
// slice indexes a given test file happens to pull in.
describe('sky slice registration', () => {
  it('claims the Sky indirection and all three materials as ONE slice (happy path)', () => {
    for (const typeName of [
      'Sky',
      'ProceduralSkyMaterial',
      'PanoramaSkyMaterial',
      'PhysicalSkyMaterial',
    ]) {
      const registration = resourceSliceRegistry.byTypeName(typeName);
      expect(registration?.slice, typeName).toBe('sky');
      expect(registration?.kind, typeName).toBe('godot-text');
    }
  });

  it('routes the sky MATERIALS to the resource slot, not the material one', () => {
    // The routing fix this claim carries: the substring rule it replaces sent
    // every type name containing "Material" to the material processor, which
    // builds THREE materials and cannot decode a sky — so an external
    // `ProceduralSkyMaterial.tres` never reached the slot its only consumer
    // (`useSubOrExtResource`) subscribes to.
    for (const typeName of [
      'ProceduralSkyMaterial',
      'PanoramaSkyMaterial',
      'PhysicalSkyMaterial',
    ]) {
      expect(resourceSliceRegistry.busTypeFor(typeName), typeName).toBe('resource');
    }
  });

  it('routes `Sky` to the resource slot with the Resource failure label', () => {
    expect(resourceSliceRegistry.busTypeFor('Sky')).toBe('resource');
    expect(resourceSliceRegistry.byTypeName('Sky')?.failureLabel).toBe('Resource');
  });

  it('claims no file extension — a sky arrives inside a .tscn or .tres (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('Sky')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byTypeName('Sky')?.binaryBytes).toBeUndefined();
  });

  it('does not claim a sky-adjacent type it cannot decode (error path)', () => {
    // A `ShaderMaterial` sky is authored Godot shader source, not one of the
    // three built-in materials, and this slice's decode would return null.
    expect(resourceSliceRegistry.byTypeName('ShaderMaterial')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('SkyMaterial')).toBeNull();
  });

  it('re-exports the decode surface and the types, not the build', () => {
    // `index.ts` must stay THREE-free: `build.ts` renders a cubemap, and the
    // routing side may not pull that into its closure.
    expect(typeof skySlice.decodeSkyMaterial).toBe('function');
    expect(typeof skySlice.skyMaterialRef).toBe('function');
    expect('buildSkyEnvironment' in skySlice).toBe(false);
  });

  it('decodes every material type name it claims — no claim without a decoder', () => {
    // The claim table is what routes a file here; a type name claimed but not
    // handled by `decode` is a resource that loads and then silently renders
    // nothing, which is exactly what routing-by-substring produced.
    const claimed = resourceSliceRegistry
      .all()
      .filter((registration) => registration.slice === 'sky')
      .flatMap((registration) => registration.typeNames)
      .filter((typeName) => typeName !== 'Sky');

    expect(claimed.length).toBe(3);
    for (const typeName of claimed) {
      expect(decodeSkyMaterial(typeName, {}), typeName).not.toBeNull();
    }
  });
});
