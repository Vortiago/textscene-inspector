/**
 * The renderer entry is the public API of `@textscene/renderer`. The package test in
 * `apps/textscene-renderer` pins its export list.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as renderer from './renderer';
import { TscnSceneContents } from './TscnCanvas';

describe('the renderer entry', () => {
  it('registers the node components, so a scene it is given draws', async () => {
    const source = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
`;

    const drawn = await ReactThreeTestRenderer.create(
      <renderer.TscnSceneProvider source={source} provider={{ loadResource: async () => null }}>
        <TscnSceneContents />
      </renderer.TscnSceneProvider>
    );

    expect(drawn.scene.findAllByType('Mesh')).toHaveLength(1);
  });
});
