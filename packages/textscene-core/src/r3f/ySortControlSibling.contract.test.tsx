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

import './nodes/index';
import './controls/index';

const FLOOR = `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Floor" type="Node2D" parent="."]
y_sort_enabled = true
`;

const tile = (y: number, name = 'Tile') => `
[node name="${name}" type="Polygon2D" parent="Floor"]
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
async function paintKeysOf<const Name extends string = 'Tile' | 'Low'>(
  tscn: string,
  names: readonly Name[] = ['Tile', 'Low'] as Name[]
) {
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
  // No settle: the Control walk and the sort exchange their results in layout effects, so the
  // first committed frame already has the order.
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
  return Object.fromEntries(names.map((name) => [name, keyOf(name)])) as Record<
    Name,
    ReturnType<typeof paintKey>
  >;
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

/** `Low` hangs under a Node2D under `Panel`, a Control at y 100 that the scene lists before the y 68 tile. */
const PANEL_FIRST = `
[node name="Panel" type="ColorRect" parent="Floor"]
offset_top = 100.0
offset_right = 40.0
offset_bottom = 140.0

[node name="Holder" type="Node2D" parent="Floor/Panel"]

[node name="Low" type="ColorRect" parent="Floor/Panel/Holder"]
offset_right = 40.0
offset_bottom = 40.0
`;

describe('a Control child of a y-sorted Node2D', () => {
  it('moves a Control promoted past a Node2D with the Control item it hangs under', async () => {
    // Three tiles sort ahead of the Panel, so in scene order `Low` would land among them.
    const keys = await paintKeysOf(FLOOR + PANEL_FIRST + tile(68, 'A') + tile(69, 'B') + tile(70, 'C'), [
      'C',
      'Low',
    ]);
    // The group order is the draw position; an equal one leaves the order to a batching tie-break.
    expect(keys.C[0]).toBeLessThan(keys.Low[0]);
  });

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
