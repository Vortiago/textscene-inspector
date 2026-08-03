import { describe, expect, it } from 'vitest';
import * as curveSlice from './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

// Importing the entry point is what registers the claim; the assertions read the
// registry, never `all()` — that array's contents depend on which other slice
// indexes a given test file happens to pull in.
describe('curve slice registration', () => {
  it('claims the `Curve` type name for the curve slice (happy path)', () => {
    const registration = resourceSliceRegistry.byTypeName('Curve');
    expect(registration?.slice).toBe('curve');
    expect(registration?.kind).toBe('godot-text');
  });

  it('routes `Curve` to the generic resource slot with the Resource failure label', () => {
    expect(resourceSliceRegistry.busTypeFor('Curve')).toBe('resource');
    expect(resourceSliceRegistry.byTypeName('Curve')?.failureLabel).toBe('Resource');
  });

  it('claims no file extension — a Curve arrives inside a .tscn or .tres (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('Curve')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byTypeName('Curve')?.binaryBytes).toBeUndefined();
  });

  it('claims a resource type, not the Nodes that consume one (error path)', () => {
    // Negatives name NODE types on purpose: a sibling resource type (`Curve2D`,
    // `CurveTexture`) is claimable by another slice, so asserting it is
    // unclaimed passes alone and fails under the aggregation barrel.
    expect(resourceSliceRegistry.byTypeName('CPUParticles2D')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('Path2D')).toBeNull();
  });

  it('re-exports the decode surface and the types, not the sampler', () => {
    expect(typeof curveSlice.decodeCurve).toBe('function');
    expect(typeof curveSlice.resolveCurve).toBe('function');
    expect(typeof curveSlice.curveFromResource).toBe('function');
    expect(curveSlice.EMPTY_CURVE.points).toEqual([]);
    expect(curveSlice.CurveTangentMode.Linear).toBe(1);
    expect('sampleCurve' in curveSlice).toBe(false);
  });
});
