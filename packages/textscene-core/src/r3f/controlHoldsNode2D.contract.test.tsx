/**
 * A Node2D below a Control stands in the canvas space of the Control: the transform of the
 * Control's canvas item, which the Control walk solves, sits between the Node2D and the Control's
 * parent (`control.cpp:719-737`, `canvas_item.cpp:176-186`).
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { ControlCanvasLayer } from './controls/native/ControlCanvasLayer';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';
import { ControlYSortProvider } from './contexts/ControlYSortContext';
import { SceneStack } from './testing/SceneStack';

import './nodes/index';
import './controls/index';

const HELD = `
[node name="Held" type="Polygon2D" parent="Panel"]
position = Vector2(20, 10)
polygon = PackedVector2Array(-15, -15, 15, -15, 15, 15, -15, 15)
`;

/** The group named `name`, once the scene has settled. */
async function settledGroup(tscn: string, name: string) {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      <ControlYSortProvider>
        <NodeDispatcher nodes={parsed.nodes} />
        <ControlCanvasLayer nodes={parsed.nodes} />
      </ControlYSortProvider>
    </SceneStack>
  );
  await renderer.advanceFrames(2, 0.016);
  const root = renderer.scene.children[0]!.instance.parent!;
  let found: THREE.Object3D | undefined;
  root.traverse((o) => {
    if (!found && (o.name === name || o.name.endsWith(`:${name}`))) found = o;
  });
  root.updateMatrixWorld(true);
  return found!;
}

/** Whether the group and every group above it is visible. */
async function isDrawn(tscn: string, name: string) {
  const group = await settledGroup(tscn, name);
  for (let o: THREE.Object3D | null = group; o; o = o.parent) if (!o.visible) return false;
  return true;
}

/** The Godot canvas position of the group named `name`: x right, y down. */
async function canvasPositionOf(tscn: string, name: string) {
  const world = (await settledGroup(tscn, name)).getWorldPosition(new THREE.Vector3());
  return { x: world.x, y: -world.y };
}

describe('a Node2D below a Control', () => {
  it('stands at the offsets of the Control plus its own position', async () => {
    const scene = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Panel" type="Control" parent="."]
offset_left = 60.0
offset_top = 30.0
${HELD}`;
    expect(await canvasPositionOf(scene, 'Held')).toEqual({ x: 80, y: 40 });
  });

  it('hides with a hidden Control', async () => {
    const scene = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Panel" type="Control" parent="."]
visible = false
${HELD}`;
    expect(await isDrawn(scene, 'Held')).toBe(false);
  });
});
