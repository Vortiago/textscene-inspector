/**
 * The renderer entry is the public API of `@textscene/renderer`. The package test in
 * `apps/textscene-renderer` pins its export list.
 */
import { describe, expect, expectTypeOf, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as renderer from './renderer';
import { TscnSceneContents } from './SceneContents';
import { TscnSceneProvider } from './TscnSceneProvider';

describe('the renderer entry', () => {
  it('exports the four values of the surface', () => {
    expect(Object.keys(renderer).sort()).toEqual(['TscnCanvas', 'mountScene', 'openScene', 'variant']);
  });

  it('requires a scene on the canvas, since the entry gives no provider to read one from', () => {
    expectTypeOf<Parameters<typeof renderer.TscnCanvas>[0]['scene']>().toEqualTypeOf<renderer.Scene>();
  });

  it('registers the node components, so a scene it is given draws', async () => {
    const source = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
`;

    const drawn = await ReactThreeTestRenderer.create(
      <TscnSceneProvider scene={renderer.openScene({ source, provider: { loadResource: async () => null } })}>
        <TscnSceneContents />
      </TscnSceneProvider>
    );

    expect(drawn.scene.findAllByType('Mesh')).toHaveLength(1);
  });
});
