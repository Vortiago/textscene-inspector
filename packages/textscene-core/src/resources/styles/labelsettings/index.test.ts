import { describe, expect, it } from 'vitest';
import * as labelSettingsSlice from './index';
import { resourceSliceRegistry } from '../../sliceRegistration';

// Importing the entry point registers the claim. The assertions read the registry
// by name, not `all()`: its contents depend on which other slice indexes load.
describe('labelsettings slice registration', () => {
  it('claims the `LabelSettings` type name for the labelsettings slice (happy path)', () => {
    const registration = resourceSliceRegistry.byTypeName('LabelSettings');
    expect(registration?.slice).toBe('labelsettings');
    expect(registration?.kind).toBe('godot-text');
  });

  it('routes `LabelSettings` to the generic resource slot with the Resource failure label', () => {
    expect(resourceSliceRegistry.busTypeFor('LabelSettings')).toBe('resource');
    expect(resourceSliceRegistry.byTypeName('LabelSettings')?.failureLabel).toBe('Resource');
  });

  it('claims no file extension — a LabelSettings arrives inside a .tscn or .tres (edge case)', () => {
    expect(resourceSliceRegistry.byTypeName('LabelSettings')?.extensions).toBeUndefined();
    expect(resourceSliceRegistry.byTypeName('LabelSettings')?.binaryBytes).toBeUndefined();
  });

  it('claims a resource type, not the Node that consumes one (error path)', () => {
    expect(resourceSliceRegistry.byTypeName('Label')).toBeNull();
  });

  it('re-exports the decode surface and the types', () => {
    expect(typeof labelSettingsSlice.decodeLabelSettings).toBe('function');
    expect(typeof labelSettingsSlice.resolveLabelSettings).toBe('function');
    expect(typeof labelSettingsSlice.labelSettingsFromResource).toBe('function');
  });
});
