import { describe, expect, it } from 'vitest';
import { resourceSliceRegistry } from '../../sliceRegistration';
import './index';

// Importing the entry point registers the claim. The assertions read the registry back.
describe('multimesh slice registration', () => {
  it('claims MultiMesh for the generic resource slot', () => {
    expect(resourceSliceRegistry.byTypeName('MultiMesh')).toMatchObject({
      slice: 'multimesh',
      kind: 'godot-text',
      busType: 'resource',
    });
  });

  it('claims the resource, not the node that holds it', () => {
    expect(resourceSliceRegistry.byTypeName('MultiMeshInstance3D')).toBeNull();
  });

  it('claims no file extension: a MultiMesh arrives inside a .tscn or .tres', () => {
    expect(resourceSliceRegistry.byTypeName('MultiMesh')?.extensions).toBeUndefined();
  });
});
