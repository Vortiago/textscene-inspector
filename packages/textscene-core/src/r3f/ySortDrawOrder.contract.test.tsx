/**
 * RED contract — Godot 2D Y-sort draw order.
 *
 * Godot semantics (verified against 4.4 renderer_canvas_cull.cpp): within a
 * `y_sort_enabled` subtree, CanvasItem descendants draw front-to-back by
 * accumulated world-Y (higher Y = in front), bucketed by effective z_index
 * (z_index dominates y-sort); a non-`y_sort_enabled` container sorts as ONE
 * unit (its children keep tree order); ties in Y fall back to tree order.
 *
 * The two container rules were re-measured against real Godot 4.6.3 rather than
 * read off the source, because they are easy to get backwards. Reproduce with
 * `pnpm ref:godot scripts/godot-ref/scenes/<scene>.tscn --probe 400,250`, where
 * the probe lands on a deliberate three-way overlap:
 *
 *   ysort-atomic-container — a PLAIN Node2D holding a low-Y and a high-Y child,
 *     beside a mid-Y sibling. Godot renders BLUE (the mid-Y sibling), so the
 *     container sorted as one unit at its OWN Y and the high-Y child did not
 *     escape it. A non-y-sorted container is atomic.
 *   ysort-nested-merge — the same tree with the container y-sorted. Godot
 *     renders GREEN (the high-Y grandchild), so a y_sort_enabled child's
 *     subtree MERGES into the parent's flat sort. Probing 600,65 also returns
 *     the container's own YELLOW body, so a y-sorted node still draws itself.
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
import { Z_INDEX_STEP } from './node2dTransform';
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

  it('RED: sibling y-sort subtrees under a non-y-sort parent do NOT interleave — subtree order is tree order, not global Y', async () => {
    // The root is NOT y-sorted; `SubA` is declared before `SubB`. So EVERY item in SubA must
    // draw entirely BEHIND every item in SubB, regardless of Y — SubA's high-Y item is still
    // behind SubB's low-Y item. Each y-sort subtree sorts internally, but the subtrees keep the
    // parent's tree order. Today each subtree's dispatcher assigns z in the SAME (0, SUBRANGE)
    // band, so SubA's high-Y item (high rank) gets z > SubB's low-Y item (low rank) → they
    // interleave → this fails. (Mirrors the dungeon: Floor's tiles drawing over Walls' decorations.)
    const z = await worldZByName(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="SubA" type="Node2D" parent="."]
y_sort_enabled = true

${poly('A_high', 'SubA', 100)}

${poly('A_low', 'SubA', -100)}

[node name="SubB" type="Node2D" parent="."]
y_sort_enabled = true

${poly('B_high', 'SubB', 100)}

${poly('B_low', 'SubB', -100)}
`);
    for (const n of ['A_high', 'A_low', 'B_high', 'B_low']) expect(z.get(n)).toBeDefined();
    const maxA = Math.max(z.get('A_high')!, z.get('A_low')!);
    const minB = Math.min(z.get('B_high')!, z.get('B_low')!);
    // SubA (declared first) entirely behind SubB (declared second) — no cross-subtree interleave.
    expect(maxA).toBeLessThan(minB);
  });

  it('RED: a Node2D atomic child of a y-sort parent honors its own z-index bucket, like a CanvasItem sibling', async () => {
    // A y-sort parent sorts its children into effective-z buckets, then by Y. Both a
    // plain CanvasItem (`Ref`) and a Node2D container (`Wrap`) carry z_index = 1, so
    // both belong in the SAME z-index bucket. `Wrap`'s child `Inner` (z_index 0) must
    // therefore render in `Wrap`'s bucket — NOT a full extra z-index step forward.
    // Bug: Node2D ignores the y-sort rank z (only CanvasItem consumes it) AND the rank
    // leaks through context to `Inner`, so `Inner` = Wrap.canvasItemZ + Wrap.rankZ,
    // double-counting the z-index step (Inner lands at ~2×Z_INDEX_STEP) → RED.
    const z = await worldZByName(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Floor" type="Node2D" parent="."]
y_sort_enabled = true

${poly('Ref', 'Floor', 0, 'z_index = 1')}

[node name="Wrap" type="Node2D" parent="Floor"]
z_index = 1

${poly('Inner', 'Floor/Wrap', 0)}
`);
    expect(z.get('Ref')).toBeDefined();
    expect(z.get('Inner')).toBeDefined();
    // Inner is in a z-index bucket (drawn in front of a z_index 0 item)…
    expect(z.get('Inner')!).toBeGreaterThan(Z_INDEX_STEP);
    // …but NOT beyond its own z_index=1 bucket (no doubled z-index step).
    expect(z.get('Inner')!).toBeLessThan(2 * Z_INDEX_STEP);
    // …and it shares Ref's bucket (both z_index=1), differing only by a rank sub-step.
    expect(Math.abs(z.get('Inner')! - z.get('Ref')!)).toBeLessThan(Z_INDEX_STEP);
  });

  it('RED: a leaf CanvasItem sitting directly in a tree-order slot lands between the y-sort subtrees', async () => {
    // `Mid` is a bare Polygon2D (a leaf CanvasItem, NOT a Node2D) declared between two y-sort
    // subtrees under the non-y-sort root — mirrors the dungeon's top-level `HighWalls` TileMapLayer
    // between `Walls` and `Decorations`. It must sit in ITS tree-order slot: behind SubB, in front
    // of SubA — even though SubA's item has a higher Y. A leaf goes through CanvasItem2D (not Node2D),
    // so it needs the slot base applied there too, else it stays at the shared layer base (z=0).
    const z = await worldZByName(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="SubA" type="Node2D" parent="."]
y_sort_enabled = true

${poly('A1', 'SubA', 100)}

${poly('Mid', '.', 0)}

[node name="SubB" type="Node2D" parent="."]
y_sort_enabled = true

${poly('B1', 'SubB', -100)}
`);
    for (const n of ['A1', 'Mid', 'B1']) expect(z.get(n)).toBeDefined();
    // Tree order Root -> [SubA, Mid, SubB]: A1 behind Mid behind B1, regardless of Y.
    expect(z.get('A1')!).toBeLessThan(z.get('Mid')!);
    expect(z.get('Mid')!).toBeLessThan(z.get('B1')!);
  });
});
