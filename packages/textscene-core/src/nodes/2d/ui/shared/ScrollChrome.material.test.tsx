/**
 * A scroll bar is a Control its owner builds (`scroll_container.cpp:917-924`), so it is a canvas item
 * of its own and draws with no material, whatever material the owner carries
 * (`renderer_canvas_cull.cpp:319-324`). An ADD CanvasItemMaterial draws through three.js custom blending.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ControlCanvasLayer } from '../../../../r3f/controls/native/ControlCanvasLayer';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { parseTscnContent } from '../../../../r3f/hooks/useParsedScene';
import { DispatchedScene } from '../../../../r3f/testing/DispatchedScene';
import { settleLoads } from '../../../../r3f/testing/settleLoads';
import { V_SCROLL } from '../scrollcontainer/internalBackPieces';
import '../../../../r3f/nodes/index';
import '../../../../r3f/controls/index';

const ADD_MATERIAL = '[sub_resource type="CanvasItemMaterial" id="add"]\nblend_mode = 1\n\n';

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

/** The blending of every mesh below the object named `name`. */
function blendingsBelow(root: THREE.Object3D, name: string): THREE.Blending[] {
  const item = root.getObjectByName(name);
  if (!item) throw new Error(`expected an object named ${name}, got none`);
  const blendings: THREE.Blending[] = [];
  item.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) blendings.push(((o as THREE.Mesh).material as THREE.Material).blending);
  });
  return blendings;
}

describe('the material of a scroll bar', () => {
  it("draws a ScrollContainer's bar with no material under an ADD container", async () => {
    const root = await drawn(`[node name="Scroll" type="ScrollContainer"]
material = SubResource("add")
offset_right = 100.0
offset_bottom = 100.0

[node name="Big" type="Control" parent="."]
custom_minimum_size = Vector2(50, 400)
layout_mode = 2
`);
    const blendings = blendingsBelow(root, V_SCROLL);
    expect(blendings.length).toBeGreaterThan(0);
    expect(new Set(blendings)).toEqual(new Set([THREE.NormalBlending]));
  });
});
