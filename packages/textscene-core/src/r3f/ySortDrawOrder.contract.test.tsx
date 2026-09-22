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
 *   ysort-nested-transform — a y-sorted container at Y=200 over a leaf at
 *     Y=100, beside a Y=250 sibling. Probing 350,480 returns the leaf's GREEN
 *     and 350,150 the background, so merging the leaf out of its parent does
 *     not cost it the parent's transform; probing 350,380 returns GREEN too,
 *     so it sorts on the accumulated Y=300, ahead of the sibling.
 *
 * The renderer maps draw order to each canvas item's `renderOrder`
 * (`canvasPaintOrder.ts`; higher draws later). These tests render real `.tscn`
 * subtrees through `NodeDispatcher` and assert the resulting order of each
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
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { PAINT_SEQUENCE_STRIDE } from './canvasPaintOrder';
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

/** The measured probe scenes named in this file's header, read where Godot rendered them. */
function probeScene(name: string): string {
  return readFileSync(join(import.meta.dirname, '../../../../scripts/godot-ref/scenes', name), 'utf8');
}

/** Render a `.tscn` subtree and return the root of the resulting THREE tree. */
async function renderTscnRoot(tscn: string): Promise<THREE.Object3D | null> {
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
  const first = (renderer.scene as unknown as { children?: Array<{ instance?: THREE.Object3D }> })
    .children?.[0]?.instance;
  let root: THREE.Object3D | null | undefined = first;
  while (root?.parent) root = root.parent;
  return root ?? null;
}

/** Every named object in the rendered tree, in traversal order (duplicates kept). */
function namedObjects(root: THREE.Object3D | null): THREE.Object3D[] {
  const found: THREE.Object3D[] = [];
  root?.traverse((o) => {
    if (o.name) found.push(o);
  });
  return found;
}

/**
 * Render a `.tscn` subtree and map each named object to its place in the canvas.
 *
 * A canvas item's group carries that place as its `renderOrder`
 * (`canvasPaintOrder.ts`) — higher draws later, the same direction the world-z
 * offset this replaces ran in, so every relative assertion below reads the
 * same way it always did.
 */
async function paintOrderByName(tscn: string): Promise<Map<string, number>> {
  const root = await renderTscnRoot(tscn);
  const map = new Map<string, number>();
  for (const o of namedObjects(root)) map.set(o.name, o.renderOrder);
  return map;
}

/**
 * The `(layer, z_final)` bucket a paint key falls in. Two items share a bucket
 * exactly when neither's z_index can put it in front of the other, whatever
 * the draw sequence says.
 */
function paintBucket(order: number): number {
  return Math.floor(order / PAINT_SEQUENCE_STRIDE);
}

describe('Y-sort draw order (issue #74) — authored contract', () => {
  it('RED: a y_sort parent draws a high-Y child in front of a low-Y child, overriding tree order', async () => {
    // "High" (Godot Y=100) is declared FIRST (tree order → behind); Y-sort must
    // flip it to the front. Currently both get z=0 → the expect fails (0 > 0).
    const z = await paintOrderByName(`[gd_scene format=3]

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
    const z = await paintOrderByName(`[gd_scene format=3]

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
    const z = await paintOrderByName(`[gd_scene format=3]

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
    const z = await paintOrderByName(`[gd_scene format=3]

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
    // leaks through to `Inner`, so `Inner` counts Wrap's bucket twice,
    // double-counting the z-index step (Inner lands two buckets forward) → RED.
    const z = await paintOrderByName(`[gd_scene format=3]

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
    // Inner is EXACTLY one z-index bucket in front of the z_index 0 container
    // it hangs under — not two, which is what double-counting would produce…
    expect(paintBucket(z.get('Inner')!)).toBe(paintBucket(z.get('Floor')!) + 1);
    // …and it shares Ref's bucket (both z_index = 1), differing only in sequence.
    expect(paintBucket(z.get('Inner')!)).toBe(paintBucket(z.get('Ref')!));
  });

  it('RED: a leaf CanvasItem sitting directly in a tree-order slot lands between the y-sort subtrees', async () => {
    // `Mid` is a bare Polygon2D (a leaf CanvasItem, NOT a Node2D) declared between two y-sort
    // subtrees under the non-y-sort root — mirrors the dungeon's top-level `HighWalls` TileMapLayer
    // between `Walls` and `Decorations`. It must sit in ITS tree-order slot: behind SubB, in front
    // of SubA — even though SubA's item has a higher Y. A leaf goes through CanvasItem2D (not Node2D),
    // so it needs the slot base applied there too, else it stays at the shared layer base (z=0).
    const z = await paintOrderByName(`[gd_scene format=3]

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

/**
 * The two container rules, asserted against the SAME `.tscn` files real Godot
 * 4.6.3 rendered — read off disk rather than retyped, so a scene edit that
 * invalidates a measurement cannot leave a green test behind. The probes and
 * the colours they returned are in this file's header.
 */
describe('Y-sort container rules (issue #356) — measured against Godot 4.6.3', () => {
  it('a y_sort_enabled node draws its OWN body, at its own rank in the merged sort', async () => {
    // `--probe 600,65` → rgb(255,255,0): the y-sorted `Sub` container's yellow
    // bar, which nothing else in the scene covers. Godot draws it, so must we.
    const root = await renderTscnRoot(probeScene('ysort-nested-merge.tscn'));
    const sub = namedObjects(root).filter((o) => o.name === 'Sub');
    expect(sub).toHaveLength(1);
    let bodies = 0;
    sub[0]!.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) bodies++;
    });
    expect(bodies).toBe(1);
  });

  it('merging a y-sorted subtree draws it ONCE, not once per level', async () => {
    // The container is now an item AND a recursion step; if the recursion were
    // replaced by a whole-node dispatch, `SubLow`/`SubHigh` would render twice.
    const root = await renderTscnRoot(probeScene('ysort-nested-merge.tscn'));
    const names = namedObjects(root).map((o) => o.name);
    for (const name of ['Root', 'YS', 'Sub', 'SubLow', 'SubHigh', 'Mid'])
      expect(names.filter((n) => n === name)).toHaveLength(1);
  });

  it("a y-sorted child's subtree MERGES into the parent's flat sort", async () => {
    // `--probe 400,250` → rgb(0,255,0): all three of `SubLow`, `Mid` and
    // `SubHigh` cover that pixel, and the highest-Y one (the grandchild
    // `SubHigh`, Y=200) wins — it sorted against `Mid` (Y=100), a node one
    // level above it. Full order: Sub (Y=0, declared first) ▸ SubLow (Y=0)
    // ▸ Mid (Y=100) ▸ SubHigh (Y=200).
    const z = await paintOrderByName(probeScene('ysort-nested-merge.tscn'));
    for (const n of ['Sub', 'SubLow', 'Mid', 'SubHigh']) expect(z.get(n)).toBeDefined();
    expect(z.get('Sub')!).toBeLessThan(z.get('SubLow')!);
    expect(z.get('SubLow')!).toBeLessThan(z.get('Mid')!);
    expect(z.get('Mid')!).toBeLessThan(z.get('SubHigh')!);
  });

  it('a merged item keeps the transform of the y-sorted levels it was lifted past', async () => {
    // `Leaf` sits under a y-sorted `Sub` at Y=200, itself at Y=100. Merging it
    // into the sort root's flat list must not cost it Sub's 200:
    //   --probe 350,480 → rgb(0,255,0)   its body reaches Y=480 …
    //   --probe 350,150 → rgb(76,76,76)  … and NOT the Y=100..300 band it would
    //                                    occupy if the lift dropped that 200.
    //   --probe 350,380 → rgb(0,255,0)   and it sorts in FRONT of `Ref` (Y=250),
    //                                    which only the accumulated Y=300 does.
    const root = await renderTscnRoot(probeScene('ysort-nested-transform.tscn'));
    const byName = new Map(namedObjects(root).map((o) => [o.name, o]));
    const world = new THREE.Vector3();
    byName.get('Leaf')!.getWorldPosition(world);
    // Godot (0, 300) → three (0, −300): the whole Root→Sub→Leaf chain composed.
    expect(world.y).toBeCloseTo(-300);
    // …and it sorts in FRONT of `Ref` (Y=250), which only the accumulated Y=300
    // does. Draw order is the group's paint key, not its z (`canvasPaintOrder`).
    expect(byName.get('Leaf')!.renderOrder).toBeGreaterThan(byName.get('Ref')!.renderOrder);
  });

  it('GUARDRAIL: a NON-y-sorted container stays one atomic unit at its own Y', async () => {
    // Same tree, container not y-sorted: `--probe 400,250` → rgb(0,0,255), the
    // mid-Y sibling. `Deco` sorts as one unit at ITS Y (0), so its high-Y child
    // never escapes to overtake `Mid`. Inside the unit tree order rules, which
    // an atomic subtree expresses by sharing one z (see the GUARDRAIL above).
    const z = await paintOrderByName(probeScene('ysort-atomic-container.tscn'));
    for (const n of ['Low', 'High', 'Mid']) expect(z.get(n)).toBeDefined();
    expect(z.get('Low')!).toBeLessThanOrEqual(z.get('High')!);
    expect(z.get('High')!).toBeLessThan(z.get('Mid')!);
  });
});
