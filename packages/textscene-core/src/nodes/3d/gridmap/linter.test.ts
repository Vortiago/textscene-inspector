/**
 * GridMap semantic rules. A `mesh_library` reference must resolve (a dangling
 * one is an error). A GridMap without one is valid and renders nothing, so it
 * warns, as Decal's requires-texture does.
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoErrors } from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('GridMap semantic rules', () => {
  it('passes a gridmap whose mesh_library resolves', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="MeshLibrary" path="res://tiles.tres" id="1_mesh"]

[node name="GridMap" type="GridMap"]
mesh_library = ExtResource("1_mesh")
cell_size = Vector3(1, 1, 1)
`;

    expectClean(content);
  });

  it('errors when the mesh_library reference does not resolve', () => {
    expectDiagnostic(
      scene(node('GridMap', { mesh_library: 'ExtResource("9_missing")', cell_size: 'Vector3(1, 1, 1)' })),
      { ruleName: 'dangling-resource-reference', severity: 'error', nodeType: 'GridMap' }
    );
  });

  it('reports at info, not error, when a gridmap has no mesh_library', () => {
    const content = scene(node('GridMap', { cell_size: 'Vector3(1, 1, 1)' }));
    expectNoErrors(content);
    expectDiagnostic(content, { ruleName: 'gridmap-requires-mesh-library', severity: 'info' });
  });
});
