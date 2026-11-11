/**
 * A Control child of a y-sorted node sorts on the origin of its canvas item, as a Node2D sorts on
 * its position (`renderer_canvas_cull.cpp:131`, `control.cpp:719-736`), so it interleaves with the
 * Node2D siblings by that y whichever of them the scene lists first.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { ControlCanvasLayer } from './controls/native/ControlCanvasLayer';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';
import { compareKeys, paintKey } from './testing/paintOrder';
import { ControlYSortProvider } from './contexts/ControlYSortContext';
import { SceneStack } from './testing/SceneStack';
import { settleLoads } from './testing/settleLoads';

import './nodes/index';
import './controls/index';

const FLOOR = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Floor" type="Node2D" parent="."]
y_sort_enabled = true
`;

const tile = (y: number) => `
[node name="Tile" type="Polygon2D" parent="Floor"]
position = Vector2(0, ${y})
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
`;

const control = (top: number) => `
[node name="Low" type="ColorRect" parent="Floor"]
offset_top = ${top}
offset_right = 40.0
offset_bottom = ${top + 40}
`;

/** The draw key of the mesh under the group whose name is, or ends in, `:name`. */
async function paintKeysOf(tscn: string) {
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
  // The Control walk publishes its origins and the sort answers with runs: one tick for each.
  await settleLoads();
  await settleLoads();
  await settleLoads();
  const root = renderer.scene.children[0]!.instance.parent!;
  const keyOf = (name: string) => {
    let found: THREE.Object3D | undefined;
    root.traverse((o) => {
      if (found || (o.name !== name && !o.name.endsWith(`:${name}`))) return;
      o.traverse((d) => {
        if (!found && (d as THREE.Mesh).isMesh) found = d;
      });
    });
    return paintKey(found!);
  };
  return { Tile: keyOf('Tile'), Low: keyOf('Low') };
}

/** `Low` sits in a y-sorted `Inner` at y 50, whose sort merges into `Floor`'s. */
const nestedControl = (top: number) => `
[node name="Inner" type="Node2D" parent="Floor"]
y_sort_enabled = true
position = Vector2(0, 50)

[node name="Low" type="ColorRect" parent="Floor/Inner"]
offset_top = ${top}
offset_right = 40.0
offset_bottom = ${top + 40}
`;

describe('a Control child of a y-sorted Node2D', () => {
  it('sorts a Control in a nested y-sorted Node2D on its origin below that Node2D', async () => {
    const keys = await paintKeysOf(FLOOR + tile(68) + nestedControl(30));
    expect(compareKeys(keys.Tile, keys.Low)).toBeLessThan(0);
  });

  it('draws over a Node2D sibling whose y is smaller, authored after it', async () => {
    const keys = await paintKeysOf(FLOOR + control(80) + tile(68));
    expect(compareKeys(keys.Tile, keys.Low)).toBeLessThan(0);
  });

  it('draws under a Node2D sibling whose y is larger, authored before it', async () => {
    const keys = await paintKeysOf(FLOOR + tile(100) + control(80));
    expect(compareKeys(keys.Low, keys.Tile)).toBeLessThan(0);
  });
});
