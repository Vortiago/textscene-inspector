/**
 * Whether a Node2D item draws below a node that hides it in Godot but that the world walk draws no
 * group for: a hidden CanvasLayer (`canvas_layer.cpp:49-64`), and a Control page that its container
 * writes `visible = false` onto (`tab_container.cpp:377-399`, `foldable_container.cpp:376-386`).
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ControlCanvasLayer } from './controls/native/ControlCanvasLayer';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { parseTscnContent } from './hooks/useParsedScene';
import { DispatchedScene } from './testing/DispatchedScene';
import { settleLoads } from './testing/settleLoads';
import { visibleInTree } from './visibleInTree';

import './nodes/index';
import './controls/index';

/** The scene's root object once `body` draws in the 2D workspace. */
async function drawn(body: string): Promise<THREE.Object3D> {
  const { sceneGraph, error } = parseTscnContent(`[gd_scene format=3]\n\n${body}`, 'res://main.tscn');
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

/** Whether the mesh of the Polygon2D named `name` draws. */
function drawsPolygon(root: THREE.Object3D, name: string): boolean {
  const item = root.getObjectByName(name);
  if (!item) throw new Error(`expected an object named ${name}, got none`);
  let mesh: THREE.Mesh | undefined;
  item.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh;
  });
  if (!mesh) throw new Error(`expected a mesh below ${name}, got none`);
  return visibleInTree(mesh);
}

const SQUARE = 'polygon = PackedVector2Array(0, 0, 10, 0, 10, 10, 0, 10)';

/** A TabContainer with `pages` pages, each a Control holding the Polygon2D `In<i>`. */
function tabs(pages: number, current: string): string {
  let body = `[node name="Root" type="Node2D"]\n\n[node name="Tabs" type="TabContainer" parent="."]\noffset_right = 400.0\noffset_bottom = 300.0\n${current}\n`;
  for (let i = 0; i < pages; i++) {
    body += `\n[node name="Page${i}" type="Control" parent="Tabs"]\n\n[node name="In${i}" type="Polygon2D" parent="Tabs/Page${i}"]\n${SQUARE}\n`;
  }
  return body;
}

/** A FoldableContainer holding a Control `Body` with the Polygon2D `Leaf`. */
function foldable(folded: string): string {
  return `[node name="Root" type="Node2D"]

[node name="Fold" type="FoldableContainer" parent="."]
offset_right = 400.0
offset_bottom = 300.0
${folded}

[node name="Body" type="Control" parent="Fold"]

[node name="Leaf" type="Polygon2D" parent="Fold/Body"]
${SQUARE}
`;
}

describe('a Node2D below a hidden CanvasLayer', () => {
  const layer = (visible: string) => `[node name="Root" type="Node2D"]

[node name="Layer" type="CanvasLayer" parent="."]
${visible}

[node name="Leaf" type="Polygon2D" parent="Layer"]
${SQUARE}
`;

  it('draws nothing while the layer is hidden', async () => {
    expect(drawsPolygon(await drawn(layer('visible = false')), 'Leaf')).toBe(false);
  });

  it('draws while the layer is shown', async () => {
    expect(drawsPolygon(await drawn(layer('')), 'Leaf')).toBe(true);
  });
});

describe('a Node2D on a TabContainer page', () => {
  it('draws on page 0 only when the file authors no `current_tab`', async () => {
    const root = await drawn(tabs(2, ''));
    expect([drawsPolygon(root, 'In0'), drawsPolygon(root, 'In1')]).toEqual([true, false]);
  });

  it('draws on the authored `current_tab` only', async () => {
    const root = await drawn(tabs(3, 'current_tab = 2'));
    expect(['In0', 'In1', 'In2'].map((name) => drawsPolygon(root, name))).toEqual([false, false, true]);
  });

  it('draws on page 0 only when `current_tab` is past the last page (`tab_bar.cpp:800-804`)', async () => {
    const root = await drawn(tabs(2, 'current_tab = 5'));
    expect([drawsPolygon(root, 'In0'), drawsPolygon(root, 'In1')]).toEqual([true, false]);
  });
});

describe('a Node2D in a FoldableContainer', () => {
  it('draws nothing while the container is folded', async () => {
    expect(drawsPolygon(await drawn(foldable('folded = true')), 'Leaf')).toBe(false);
  });

  it('draws while the container is open', async () => {
    expect(drawsPolygon(await drawn(foldable('')), 'Leaf')).toBe(true);
  });
});
