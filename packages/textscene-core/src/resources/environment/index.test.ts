import { describe, expect, it } from 'vitest';
import * as environmentSlice from './index';
import { resourceSliceRegistry } from '../sliceRegistration';

// Importing the entry point is what registers the claim; the assertions read the
// registry by name, never `all()` — that array's contents depend on which other
// slice indexes a given test file happens to pull in.
describe('environment slice registration', () => {
  it('claims the `Environment` type name for the environment slice (happy path)', () => {
    const registration = resourceSliceRegistry.byTypeName('Environment');
    expect(registration?.slice).toBe('environment');
    expect(registration?.kind).toBe('godot-text');
  });

  it('routes `Environment` to the generic resource slot with the Resource failure label', () => {
    expect(resourceSliceRegistry.busTypeFor('Environment')).toBe('resource');
    expect(resourceSliceRegistry.byTypeName('Environment')?.failureLabel).toBe('Resource');
  });

  it('claims no file extension — an Environment arrives inside a .tscn or .tres (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('Environment')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byTypeName('Environment')?.binaryBytes).toBeUndefined();
  });

  it('does not claim the node that HOLDS an environment (error path)', () => {
    // `WorldEnvironment` is a node slice, not a resource one; claiming it would
    // route a scene node through the resource pipeline.
    expect(resourceSliceRegistry.byTypeName('WorldEnvironment')).toBeNull();
    expect(resourceSliceRegistry.byTypeName('CameraAttributesPractical')).toBeNull();
  });

  it('re-exports the decode surface and both data types, not the build', () => {
    // `index.ts` must stay clear of `build.ts`: routing and linting read this
    // entry point, and neither may pull the render side into its closure.
    expect(typeof environmentSlice.decodeEnvironment).toBe('function');
    expect(environmentSlice.BackgroundMode.BG_SKY).toBe(2);
    expect('createEnvironmentSettings' in environmentSlice).toBe(false);
  });
});
