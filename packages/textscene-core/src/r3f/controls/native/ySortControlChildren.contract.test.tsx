/**
 * A `y_sort_enabled` Control draws its Control children in y order, as Godot's
 * `_collect_ysort_children` does for any CanvasItem (`renderer_canvas_cull.cpp:110-160`):
 * the child whose canvas item origin is lower on screen draws later, and equal y keeps tree order.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ControlCanvasLayer } from './ControlCanvasLayer';
import { NodeDispatcher } from '../../NodeDispatcher';
import { ControlYSortProvider } from '../../contexts/ControlYSortContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { compareKeys, paintKey } from '../../testing/paintOrder';
import { SceneStack } from '../../testing/SceneStack';

import '../../nodes/index';
import '../index';

/** A 40 px square ColorRect whose top edge sits at `top`. */
function rect(name: string, top: number, extra = ''): string {
  return `[node name="${name}" type="ColorRect" parent="."]
offset_top = ${top}
offset_right = 40.0
offset_bottom = ${top + 40}
${extra}`;
}

/** Renders both walks for `tscn` and returns the draw key of the mesh under each named node. */
async function paintKeysOf(tscn: string, names: readonly string[], hasWorldSort = true) {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      {hasWorldSort ? (
        <ControlYSortProvider>
          <NodeDispatcher nodes={parsed.nodes} />
          <ControlCanvasLayer nodes={parsed.nodes} />
        </ControlYSortProvider>
      ) : (
        <ControlCanvasLayer nodes={parsed.nodes} />
      )}
    </SceneStack>
  );
  // No settle: the first committed frame already has the order. The test renderer flushes passive
  // effects too, so this does not prove the layout-effect timing.
  const meshes = new Map<string, THREE.Object3D>();
  renderer.scene.children[0]?.instance.parent?.traverse((object: THREE.Object3D) => {
    if (!(object as THREE.Mesh).isMesh) return;
    for (let up = object.parent; up; up = up.parent) {
      const name = names.find((n) => up!.name === n || up!.name.endsWith(`:${n}`));
      if (name) meshes.set(name, object);
    }
  });
  return Object.fromEntries(names.map((name) => [name, paintKey(meshes.get(name)!)]));
}

const rootControl = (sorted: boolean) => `[gd_scene format=3]

[node name="Root" type="Control"]
y_sort_enabled = ${sorted}
`;

describe('a y_sort_enabled Control draws its Control children in y order', () => {
  it('draws a lower child over a higher one authored after it', async () => {
    const keys = await paintKeysOf(rootControl(true) + rect('Low', 100) + rect('High', 0), ['Low', 'High']);
    expect(compareKeys(keys.High!, keys.Low!)).toBeLessThan(0);
  });

  it('keeps tree order when the sort y is equal', async () => {
    const keys = await paintKeysOf(rootControl(true) + rect('First', 50) + rect('Second', 50), [
      'First',
      'Second',
    ]);
    expect(compareKeys(keys.First!, keys.Second!)).toBeLessThan(0);
  });

  it('keeps tree order without y_sort_enabled', async () => {
    const keys = await paintKeysOf(rootControl(false) + rect('Low', 100) + rect('High', 0), ['Low', 'High']);
    expect(compareKeys(keys.Low!, keys.High!)).toBeLessThan(0);
  });
});

describe('a y_sort_enabled Control merges its y-sorted Control children into one sort', () => {
  it('interleaves a nested y-sorted Control child with its parent siblings', async () => {
    const tscn =
      rootControl(true) +
      `[node name="Inner" type="Control" parent="."]
y_sort_enabled = true
offset_top = 100.0

` +
      `[node name="Deep" type="ColorRect" parent="Inner"]
offset_right = 40.0
offset_bottom = 40.0

` +
      rect('Mid', 50);
    const keys = await paintKeysOf(tscn, ['Deep', 'Mid']);
    expect(compareKeys(keys.Mid!, keys.Deep!)).toBeLessThan(0);
  });

  it('sorts a Node2D child with the Control children', async () => {
    const tscn =
      rootControl(true) +
      `[node name="Sprite" type="Polygon2D" parent="."]
position = Vector2(0, 100)
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)

` +
      rect('Low', 50);
    const keys = await paintKeysOf(tscn, ['Low', 'Sprite']);
    expect(compareKeys(keys.Low!, keys.Sprite!)).toBeLessThan(0);
  });
});

describe('a Control walk with no world sort to join sorts its own Controls', () => {
  it('draws a lower child over a higher one authored after it, nested sorts merged', async () => {
    const tscn =
      rootControl(true) +
      `[node name="Inner" type="Control" parent="."]
y_sort_enabled = true
offset_top = 100.0

` +
      `[node name="Deep" type="ColorRect" parent="Inner"]
offset_right = 40.0
offset_bottom = 40.0

` +
      rect('Mid', 50);
    const keys = await paintKeysOf(tscn, ['Deep', 'Mid'], false);
    expect(compareKeys(keys.Mid!, keys.Deep!)).toBeLessThan(0);
  });
});
