/**
 * A ScrollContainer's bars are `INTERNAL_MODE_BACK` children (`scroll_container.cpp:917-924`), so a
 * y-sort that collects the container collects each bar as an entry of its own, at the bar's y and
 * after the authored children (`renderer_canvas_cull.cpp:110-160`).
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ControlCanvasLayer } from '../../../../r3f/controls/native/ControlCanvasLayer';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../../parser/TscnParser';
import { DispatchedScene } from '../../../../r3f/testing/DispatchedScene';
import { createSceneGraphFromTscnScene } from '../../../../core/SceneGraph.testkit';
import { compareKeys, paintKey } from '../../../../r3f/testing/paintOrder';

import '../../../../r3f/nodes/index';
import '../../../../r3f/controls/index';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;
const mounted: Renderer[] = [];
afterEach(async () => {
  for (const renderer of mounted.splice(0)) await renderer.unmount();
});

/**
 * A y-sorted ScrollContainer at y 100 whose content overflows both axes, so its vertical bar sorts
 * at y 100 and its horizontal bar near y 392, and `Ball` at y 350 between them.
 */
function scrollScene(isRootSorted: boolean): string {
  return `[gd_scene format=3]

[node name="Root" type="Node2D"]
y_sort_enabled = ${isRootSorted}

[node name="Scroll" type="ScrollContainer" parent="."]
offset_left = 100.0
offset_top = 100.0
offset_right = 400.0
offset_bottom = 400.0
y_sort_enabled = true

[node name="Content" type="ColorRect" parent="Scroll"]
custom_minimum_size = Vector2(600, 600)

[node name="Ball" type="Polygon2D" parent="."]
position = Vector2(350, 350)
polygon = PackedVector2Array(0, 0, 200, 0, 200, 200, 0, 200)
`;
}

type PaintKey = ReturnType<typeof paintKey>;

/** The draw key of the first mesh under each named object. */
async function paintKeysOf(tscn: string, names: readonly string[]): Promise<Record<string, PaintKey>> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene
      sceneGraph={createSceneGraphFromTscnScene(parsed)}
      workspace="2d"
      loader={fake.loader}
      around={(nodes) => (
        <>
          {nodes}
          <ControlCanvasLayer nodes={parsed.nodes} />
        </>
      )}
    />
  );
  mounted.push(renderer);
  await renderer.advanceFrames(2, 0.016);
  const keys: Record<string, PaintKey> = {};
  renderer.scene.children[0]!.instance.parent!.traverse((object: THREE.Object3D) => {
    if (!(object as THREE.Mesh).isMesh) return;
    const name = nameAbove(object, names);
    if (name && !keys[name]) keys[name] = paintKey(object);
  });
  for (const name of names) if (!keys[name]) throw new Error(`expected a mesh under ${name}, found none`);
  return keys;
}

function nameAbove(object: THREE.Object3D, names: readonly string[]): string | undefined {
  for (let up = object.parent; up; up = up.parent) {
    const name = names.find((n) => up!.name === n || up!.name.endsWith(`:${n}`));
    if (name) return name;
  }
  return undefined;
}

describe('the bars of a y-sorted ScrollContainer in an outer sort', () => {
  it('draws the horizontal bar over a sibling that sorts above the bar', async () => {
    const keys = await paintKeysOf(scrollScene(true), ['Ball', '_h_scroll']);
    expect(compareKeys(keys.Ball!, keys._h_scroll!)).toBeLessThan(0);
  });

  it('draws the vertical bar under a sibling that sorts below the bar', async () => {
    const keys = await paintKeysOf(scrollScene(true), ['Ball', '_v_scroll']);
    expect(compareKeys(keys._v_scroll!, keys.Ball!)).toBeLessThan(0);
  });

  it('draws both bars over the content, which sorts at the same y and earlier', async () => {
    const keys = await paintKeysOf(scrollScene(true), ['Content', '_h_scroll', '_v_scroll']);
    expect(compareKeys(keys.Content!, keys._v_scroll!)).toBeLessThan(0);
    expect(compareKeys(keys.Content!, keys._h_scroll!)).toBeLessThan(0);
  });
});

describe('the bars of a y-sorted ScrollContainer that is the sort root', () => {
  it('draws the bars after the content, as the root collects them after its children', async () => {
    const keys = await paintKeysOf(scrollScene(false), ['Content', '_h_scroll', '_v_scroll']);
    expect(compareKeys(keys.Content!, keys._v_scroll!)).toBeLessThan(0);
    expect(compareKeys(keys.Content!, keys._h_scroll!)).toBeLessThan(0);
  });
});
