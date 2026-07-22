/**
 * RED contract — Godot 2D Y-sort draw order (issue #74).
 *
 * Godot semantics (verified against 4.4 renderer_canvas_cull.cpp): within a
 * `y_sort_enabled` subtree, CanvasItem descendants draw front-to-back by
 * accumulated world-Y (higher Y = in front), bucketed by effective z_index
 * (z_index dominates y-sort); a non-`y_sort_enabled` container sorts as ONE
 * unit (its children keep tree order); ties in Y fall back to tree order.
 *
 * The renderer maps draw order to `position.z` (higher accumulated z = drawn in
 * front, per `canvasItemZ`). These tests render real `.tscn` subtrees through
 * `NodeDispatcher` and assert the resulting accumulated world-z order of each
 * child's rendered group. This is the authored contract — do NOT weaken it.
 * Implementation guidance is in the plan + operator corrections (within-bucket
 * rank-based z sub-steps; single sort site in PlainNode's child dispatch; stable
 * sort with tree-order tiebreak).
 *
 * The tile-vs-sprite interleave (the dungeon's actual symptom) and its visual
 * golden are REQUIRED by the plan and verified by the build's own integration
 * test + `pnpm test:visual`; this file pins the node-level sort mechanism the
 * tilemap path builds on. Children use Polygon2D (renders a findable named group
 * from inline points, no external texture) as observable Y-sort participants.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { CanvasWorkspaceProvider } from './contexts/CanvasWorkspaceContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { SceneResourcesProvider } from './SceneResourcesContext';
import { ResourceLoaderProvider } from '../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { TscnParser } from '../parser/TscnParser';

import './nodes/index';

/** A Polygon2D `.tscn` node body (small triangle) at the given Godot Y, plus extra props. */
function poly(name: string, parent: string, godotY: number, extra = ''): string {
  return `[node name="${name}" type="Polygon2D" parent="${parent}"]
position = Vector2(0, ${godotY})
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
${extra}`;
}

/** Render a `.tscn` subtree and map each named object to its accumulated world-Z. */
async function worldZByName(tscn: string): Promise<Map<string, number>> {
  const scene = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={scene.internalResources}
          externalResources={scene.externalResources}
        >
          <SelectionProvider>
            <NodeDispatcher nodes={scene.nodes} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  const map = new Map<string, number>();
  const v = new THREE.Vector3();
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  root?.traverse((o: THREE.Object3D) => {
    if (o.name) {
      o.getWorldPosition(v);
      map.set(o.name, v.z);
    }
  });
  return map;
}

describe('Y-sort draw order (issue #74) — authored contract', () => {
  it('RED: a y_sort parent draws a high-Y child in front of a low-Y child, overriding tree order', async () => {
    // "High" (Godot Y=100) is declared FIRST (tree order → behind); Y-sort must
    // flip it to the front. Currently both get z=0 → the expect fails (0 > 0).
    const z = await worldZByName(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Floor" type="Node2D" parent="."]
y_sort_enabled = true

${poly('High', 'Floor', 100)}

${poly('Low', 'Floor', -100)}
`);
    expect(z.get('High')).toBeDefined();
    expect(z.get('Low')).toBeDefined();
    expect(z.get('High')!).toBeGreaterThan(z.get('Low')!);
  });

  it('GUARDRAIL: a non-y_sort container is a single unit — its children keep tree order, not Y order', async () => {
    // `Deco` is NOT y_sort_enabled: inside it, tree order wins regardless of Y.
    const z = await worldZByName(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Floor" type="Node2D" parent="."]
y_sort_enabled = true

[node name="Deco" type="Node2D" parent="Floor"]

${poly('DHigh', 'Floor/Deco', 100)}

${poly('DLow', 'Floor/Deco', -100)}
`);
    // DHigh declared first must NOT end up in front of DLow (container not y-sorted).
    expect(z.get('DHigh')!).toBeLessThanOrEqual(z.get('DLow')!);
  });

  it('GUARDRAIL: z_index dominates y-sort — a lower-Y child at higher z_index draws in front', async () => {
    const z = await worldZByName(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Floor" type="Node2D" parent="."]
y_sort_enabled = true

${poly('LowHiZ', 'Floor', -100, 'z_index = 1')}

${poly('HighLoZ', 'Floor', 100)}
`);
    expect(z.get('LowHiZ')!).toBeGreaterThan(z.get('HighLoZ')!);
  });
});
