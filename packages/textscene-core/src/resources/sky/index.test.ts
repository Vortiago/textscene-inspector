import { describe, expect, it } from 'vitest';
import * as skySlice from './index';
import { skyMaterialText } from './skyMaterialText';
import { resourceSliceRegistry } from '../sliceRegistration';

// Importing the entry point registers the claims. The assertions read the registry
// by name, not `all()`: its contents depend on which other slice indexes load.
describe('sky slice registration', () => {
  it('claims the Sky indirection and all three materials as ONE slice (happy path)', () => {
    for (const typeName of ['Sky', 'ProceduralSkyMaterial', 'PanoramaSkyMaterial', 'PhysicalSkyMaterial']) {
      const registration = resourceSliceRegistry.byTypeName(typeName);
      expect(registration?.slice, typeName).toBe('sky');
      expect(registration?.kind, typeName).toBe('godot-text');
    }
  });

  it('routes the sky MATERIALS to the resource slot, not the material one', () => {
    // The material processor builds THREE materials and cannot decode a sky, so
    // an external `ProceduralSkyMaterial.tres` must reach `useSubOrExtResource`.
    for (const typeName of ['ProceduralSkyMaterial', 'PanoramaSkyMaterial', 'PhysicalSkyMaterial']) {
      expect(resourceSliceRegistry.byTypeName(typeName)?.busType ?? null, typeName).toBe('resource');
    }
  });

  it('routes `Sky` to the resource slot', () => {
    expect(resourceSliceRegistry.byTypeName('Sky')?.busType ?? null).toBe('resource');
  });

  it('claims no file extension — a sky arrives inside a .tscn or .tres (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('Sky')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byTypeName('Sky')?.binaryBytes).toBeUndefined();
  });

  it('does not claim a sky-adjacent type it cannot decode (error path)', () => {
    // A `ShaderMaterial` sky is authored shader source, which this decode refuses.
    expect(resourceSliceRegistry.byTypeName('ShaderMaterial')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('SkyMaterial')).toBeNull();
  });

  it('keeps the build out of the entry point', () => {
    // `index.ts` stays THREE-free, so routing never pulls in the cubemap render.
    expect('buildShaderSkyEnvironment' in skySlice).toBe(false);
  });

  it('generates the shader of every material type name it claims — no claim without a generator', () => {
    // A type name claimed but not generated loads and then renders nothing.
    const claimed = resourceSliceRegistry
      .all()
      .filter((registration) => registration.slice === 'sky')
      .flatMap((registration) => registration.typeNames)
      .filter((typeName) => typeName !== 'Sky');

    expect(claimed.length).toBe(3);
    for (const typeName of claimed) {
      expect(skyMaterialText(typeName, {}, {}), typeName).not.toBeNull();
    }
  });
});
