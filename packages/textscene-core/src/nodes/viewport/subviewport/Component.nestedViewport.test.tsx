/**
 * A nested SubViewport in a 3D SubViewport that also holds a 2D item mounts once. The world's
 * portal and the canvas over it hold the same children, and both workspaces mount a viewport.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { drawsOf } from './viewportPasses.testkit';

import '../../../r3f/nodes/index';
import '../../../r3f/controls/index';

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="View" type="SubViewport" parent="."]
size = Vector2i(200, 150)

[node name="Camera3D" type="Camera3D" parent="View"]

[node name="Box" type="MeshInstance3D" parent="View"]

[node name="Shape" type="Polygon2D" parent="View"]
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100)

[node name="Inner" type="SubViewport" parent="View"]

[node name="InnerCamera" type="Camera3D" parent="View/Inner"]

[node name="InnerBox" type="MeshInstance3D" parent="View/Inner"]
`;

function countNamed(root: THREE.Object3D, name: string): number {
  let count = 0;
  root.traverse((object) => {
    if (object.name === name) count += 1;
  });
  return count;
}

describe('a SubViewport nested in a 3D SubViewport with a 2D item', () => {
  beforeAll(() => import('./CanvasOverWorld'));

  it('mounts the nested viewport once', async () => {
    const draws = await drawsOf(SCENE);
    const scenes = new Set(draws.map((draw) => draw.scene));
    const mounts = [...scenes].reduce((total, scene) => total + countNamed(scene, 'Inner'), 0);
    expect(mounts).toBe(1);
  });
});
