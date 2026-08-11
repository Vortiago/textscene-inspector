import { describe, expect, it } from 'vitest';
import * as gradientSlice from './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

// Importing the entry point is what registers the claims; the assertions read
// the registry, never `all()` — that array's contents depend on which other
// slice indexes a given test file happens to pull in.
describe('gradient slice registration', () => {
  it('claims both `Gradient` and `GradientTexture2D` for one slice (happy path)', () => {
    expect(resourceSliceRegistry.byTypeName('Gradient')?.slice).toBe('gradienttexture2d');
    expect(resourceSliceRegistry.byTypeName('GradientTexture2D')?.slice).toBe(
      'gradienttexture2d'
    );
    expect(resourceSliceRegistry.byTypeName('Gradient')?.kind).toBe('godot-text');
  });

  it('routes both claims to the generic resource slot with the Resource label', () => {
    expect(resourceSliceRegistry.busTypeFor('Gradient')).toBe('resource');
    expect(resourceSliceRegistry.busTypeFor('GradientTexture2D')).toBe('resource');
    expect(resourceSliceRegistry.byTypeName('GradientTexture2D')?.failureLabel).toBe('Resource');
  });

  it('claims no file extension — a gradient arrives inside a .tscn or .tres (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('Gradient')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byTypeName('Gradient')?.binaryBytes).toBeUndefined();
  });

  it('claims resource types, not the Nodes that consume one (error path)', () => {
    // Negatives name NODE types on purpose: a sibling resource type
    // (`GradientTexture1D`, `NoiseTexture2D`) is claimable by another slice, so
    // asserting it is unclaimed passes alone and fails under the aggregation
    // barrel.
    expect(resourceSliceRegistry.byTypeName('PointLight2D')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('CPUParticles2D')).toBeNull();
  });

  it('re-exports the decode surface and the types, not the rasteriser', () => {
    expect(typeof gradientSlice.decodeGradient).toBe('function');
    expect(typeof gradientSlice.decodeGradientTexture2D).toBe('function');
    expect(typeof gradientSlice.resolveGradient).toBe('function');
    expect(typeof gradientSlice.gradientFromResource).toBe('function');
    expect(gradientSlice.GradientFill.Radial).toBe(1);
    expect('rasterizeGradientTexture2D' in gradientSlice).toBe(false);
    expect('resolveGradientTexture2D' in gradientSlice).toBe(false);
  });
});
