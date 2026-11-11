/**
 * A `y_sort_enabled` Control draws its Control children in y order, as Godot's
 * `_collect_ysort_children` does for any CanvasItem (`renderer_canvas_cull.cpp:110-160`):
 * the child whose canvas item origin is lower on screen draws later, and equal y keeps tree order.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ControlCanvasLayer } from './ControlCanvasLayer';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../../../parser/TscnParser';
import { compareKeys, paintKey } from '../../testing/paintOrder';
import { SceneStack } from '../../testing/SceneStack';
import { settleLoads } from '../../testing/settleLoads';

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

/** Renders the Control layer for `tscn` and returns the draw key of each named ColorRect. */
async function paintKeysOf(tscn: string, names: readonly string[]) {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      <ControlCanvasLayer nodes={parsed.nodes} />
    </SceneStack>
  );
  await settleLoads();
  const meshes = new Map<string, THREE.Object3D>();
  renderer.scene.children[0]?.instance.parent?.traverse((object: THREE.Object3D) => {
    if (!(object as THREE.Mesh).isMesh) return;
    for (let up = object.parent; up; up = up.parent) {
      const name = names.find((n) => up!.name === `ColorRect:${n}`);
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
