/**
 * The renderer entry is the public API of `@textscene/renderer`: each name it exports is a promise
 * to every consumer, so the list changes in this test first.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnParser } from '../parser/TscnParser';
import * as renderer from './renderer';
import { TscnSceneContents } from './TscnCanvas';

describe('the renderer entry', () => {
  it('exports exactly the public values', () => {
    expect(Object.keys(renderer).sort()).toEqual(['TscnCanvas', 'TscnSceneProvider', 'useSelection']);
  });

  it('registers the node components, so a scene it is given draws', async () => {
    const scene = new TscnParser().parse(`[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]

[node name="Cube" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")
`);

    const drawn = await ReactThreeTestRenderer.create(
      <renderer.TscnSceneProvider scene={scene} provider={{ loadResource: async () => null }}>
        <TscnSceneContents />
      </renderer.TscnSceneProvider>
    );

    expect(drawn.scene.findAllByType('Mesh')).toHaveLength(1);
  });
});
