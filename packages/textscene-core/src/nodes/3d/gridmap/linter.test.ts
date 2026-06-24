/**
 * Tests for GridMap semantic linter rules.
 *
 * GridMap references a MeshLibrary via the `mesh_library` property. If the
 * reference is provided, it must resolve to a declared resource (a dangling
 * reference is an error). A GridMap with NO mesh_library renders nothing — it
 * is valid but almost certainly a mistake, so it's a WARNING, not an error
 * (mirrors decal's requires-texture). (Format validation of cell_size etc.
 * lives in linterParser.ts.)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../linter/Linter';
import './linterParser';
import './linter';

describe('GridMap semantic rules', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('passes a gridmap whose mesh_library resolves', () => {
    const content = `[gd_scene load_steps=2 format=3]

[ext_resource type="MeshLibrary" path="res://tiles.tres" id="1_mesh"]

[node name="GridMap" type="GridMap"]
mesh_library = ExtResource("1_mesh")
cell_size = Vector3(1, 1, 1)
`;

    expect(linter.lint(content)).toHaveLength(0);
  });

  it('errors when the mesh_library reference does not resolve', () => {
    const content = `[gd_scene format=3]

[node name="GridMap" type="GridMap"]
mesh_library = ExtResource("9_missing")
cell_size = Vector3(1, 1, 1)
`;

    const diagnostics = linter.lint(content);
    const err = diagnostics.find((d) => d.ruleName === 'valid-gridmap-resources');
    expect(err).toBeDefined();
    expect(err!.severity).toBe('error');
    expect(err!.nodeType).toBe('GridMap');
  });

  it('warns (not errors) when a gridmap has no mesh_library', () => {
    const content = `[gd_scene format=3]

[node name="GridMap" type="GridMap"]
cell_size = Vector3(1, 1, 1)
`;

    const diagnostics = linter.lint(content);
    expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    const warn = diagnostics.find((d) => d.ruleName === 'gridmap-requires-mesh-library');
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe('warning');
  });
});
