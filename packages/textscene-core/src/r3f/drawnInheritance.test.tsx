/**
 * What a drawn item inherits from the items above it in the whole scene, through the dispatcher and
 * the Control walk together: the modulate product and `z_final` of `_cull_canvas_item`
 * (`renderer_canvas_cull.cpp:430-434`, `:460-466`), for the items the canvas item pass reaches.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ControlCanvasLayer } from './controls/native/ControlCanvasLayer';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { parseTscnContent } from './hooks/useParsedScene';
import { DispatchedScene } from './testing/DispatchedScene';
import { settleLoads } from './testing/settleLoads';

import './nodes/index';
import './controls/index';

/** The scene's root object once `body` draws in the 2D workspace. */
async function drawn(body: string): Promise<THREE.Object3D> {
  const { sceneGraph, error } = parseTscnContent(
    `[gd_scene format=3]\n\n${ADD_MATERIAL}${body}`,
    'res://main.tscn'
  );
  if (!sceneGraph) throw new Error(`expected a scene, got ${error}`);
  const nodes = sceneGraph.scenes.get(sceneGraph.rootScene)!.nodes;
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene
      sceneGraph={sceneGraph}
      workspace="2d"
      loader={createFakeResourceLoader().loader}
      around={(dispatched) => (
        <>
          {dispatched}
          <ControlCanvasLayer nodes={nodes} />
        </>
      )}
    />
  );
  await settleLoads();
  let root = renderer.scene.children[0]!.instance as THREE.Object3D;
  while (root.parent) root = root.parent;
  return root;
}

/** The first mesh below the object named `name`. */
function meshOf(root: THREE.Object3D, name: string): THREE.Mesh {
  const item = root.getObjectByName(name);
  if (!item) throw new Error(`expected an object named ${name}, got none`);
  let mesh: THREE.Mesh | undefined;
  item.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  if (!mesh) throw new Error(`expected a mesh below ${name}, got none`);
  return mesh;
}

function opacityOf(root: THREE.Object3D, name: string): number {
  return (meshOf(root, name).material as THREE.MeshBasicMaterial).opacity;
}

function blendingOf(root: THREE.Object3D, name: string): THREE.Blending {
  return (meshOf(root, name).material as THREE.Material).blending;
}

/** The draw-order key of the item group named `name`, which packs its `z_final` above its sequence. */
function drawKeyOf(root: THREE.Object3D, name: string): number {
  const item = root.getObjectByName(name);
  if (!item) throw new Error(`expected an object named ${name}, got none`);
  return item.renderOrder;
}

const ADD_MATERIAL = '[sub_resource type="CanvasItemMaterial" id="add"]\nblend_mode = 1\n\n';
const SQUARE = 'polygon = PackedVector2Array(0, 0, 10, 0, 10, 10, 0, 10)';
const HALF_ALPHA = 'modulate = Color(1, 1, 1, 0.5)';

describe('the modulate product a drawn item inherits', () => {
  it('reaches a Polygon2D below a Control below a modulated Node2D', async () => {
    const root = await drawn(`[node name="Root" type="Node2D"]
${HALF_ALPHA}

[node name="Panel" type="Control" parent="."]
${HALF_ALPHA}

[node name="Poly" type="Polygon2D" parent="Panel"]
${SQUARE}
`);
    expect(opacityOf(root, 'Poly')).toBeCloseTo(0.25, 6);
  });

  it('reaches a ColorRect the Control walk draws below a modulated Node2D', async () => {
    const root = await drawn(`[node name="Root" type="Node2D"]
${HALF_ALPHA}

[node name="Rect" type="ColorRect" parent="."]
offset_right = 10.0
offset_bottom = 10.0
`);
    expect(opacityOf(root, 'ColorRect:Rect')).toBeCloseTo(0.5, 6);
  });

  it('reaches a Polygon2D below a Control child of a y-sorted Node2D', async () => {
    const root = await drawn(`[node name="Root" type="Node2D"]
y_sort_enabled = true
${HALF_ALPHA}

[node name="Panel" type="Control" parent="."]
${HALF_ALPHA}

[node name="Poly" type="Polygon2D" parent="Panel"]
${SQUARE}
`);
    expect(opacityOf(root, 'Poly')).toBeCloseTo(0.25, 6);
  });

  it('reaches a Polygon2D below a Path2D', async () => {
    const root = await drawn(`[node name="Root" type="Node2D"]

[node name="Path" type="Path2D" parent="."]
${HALF_ALPHA}

[node name="Poly" type="Polygon2D" parent="Path"]
${SQUARE}
`);
    expect(opacityOf(root, 'Poly')).toBeCloseTo(0.5, 6);
  });

  it('reaches a Polygon2D below a Camera2D', async () => {
    const root = await drawn(`[node name="Root" type="Node2D"]

[node name="Camera" type="Camera2D" parent="."]
${HALF_ALPHA}

[node name="Poly" type="Polygon2D" parent="Camera"]
${SQUARE}
`);
    expect(opacityOf(root, 'Poly')).toBeCloseTo(0.5, 6);
  });
});

describe('the z_final a drawn item inherits', () => {
  it('folds the z_index of a PathFollow2D into its child', async () => {
    const root = await drawn(`[node name="Root" type="Node2D"]

[node name="Path" type="Path2D" parent="."]

[node name="Follow" type="PathFollow2D" parent="Path"]
z_index = 3

[node name="Inside" type="Polygon2D" parent="Path/Follow"]
${SQUARE}

[node name="Beside" type="Polygon2D" parent="."]
z_index = 2
${SQUARE}
`);
    expect(drawKeyOf(root, 'Inside')).toBeGreaterThan(drawKeyOf(root, 'Beside'));
  });

  it('folds the z_index of a Camera2D into its child', async () => {
    const root = await drawn(`[node name="Root" type="Node2D"]

[node name="Camera" type="Camera2D" parent="."]
z_index = 3

[node name="Inside" type="Polygon2D" parent="Camera"]
${SQUARE}

[node name="Beside" type="Polygon2D" parent="."]
z_index = 2
${SQUARE}
`);
    expect(drawKeyOf(root, 'Inside')).toBeGreaterThan(drawKeyOf(root, 'Beside'));
  });
});

describe('the material a drawn item inherits', () => {
  // An ADD CanvasItemMaterial draws through three.js custom blending.
  it('reaches a Polygon2D with use_parent_material below a Camera2D', async () => {
    const root = await drawn(`[node name="Root" type="Node2D"]

[node name="Camera" type="Camera2D" parent="."]
material = SubResource("add")

[node name="Poly" type="Polygon2D" parent="Camera"]
use_parent_material = true
${SQUARE}
`);
    expect(blendingOf(root, 'Poly')).toBe(THREE.CustomBlending);
  });
});
