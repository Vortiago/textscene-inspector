/**
 * Godot 2D Y-sort draw order (renderer_canvas_cull.cpp), asserted on each rendered
 * group's `renderOrder` (`canvasPaintOrder.ts`, higher draws later). In a
 * `y_sort_enabled` subtree, higher accumulated Y draws in front within a z_index
 * bucket, and a tie keeps tree order. Polygon2D children need no external texture.
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

/** Render a `.tscn` subtree and map each named object to its `renderOrder`: higher draws later. */
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
    // "High" (Godot Y=100) is declared first (tree order: behind). Y-sort must
    // flip it to the front.
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
    // `Deco` is not y_sort_enabled: inside it, tree order wins regardless of Y.
    const z = await paintOrderByName(`[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Floor" type="Node2D" parent="."]
y_sort_enabled = true

[node name="Deco" type="Node2D" parent="Floor"]

${poly('DHigh', 'Floor/Deco', 100)}

${poly('DLow', 'Floor/Deco', -100)}
`);
    // DHigh declared first must not end up in front of DLow (container not y-sorted).
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
    // The root is not y-sorted and `SubA` is declared before `SubB`, so every item in SubA
    // draws behind every item in SubB, whatever its Y. Each y-sort subtree sorts
    // internally, but the subtrees keep the parent's tree order.
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
    // SubA (declared first) entirely behind SubB (declared second): no cross-subtree interleave.
    expect(maxA).toBeLessThan(minB);
  });

  it('RED: a Node2D atomic child of a y-sort parent honors its own z-index bucket, like a CanvasItem sibling', async () => {
    // A y-sort parent sorts its children into effective-z buckets, then by Y. A plain
    // CanvasItem (`Ref`) and a Node2D container (`Wrap`) both carry z_index = 1, so
    // `Wrap`'s child `Inner` (z_index 0) renders in that bucket, not one step further:
    // a rank that leaks through to `Inner` counts the z-index step twice.
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
    // Inner is one z-index bucket in front of the z_index 0 container it hangs
    // under, not two…
    expect(paintBucket(z.get('Inner')!)).toBe(paintBucket(z.get('Floor')!) + 1);
    // …and it shares Ref's bucket (both z_index = 1), differing only in sequence.
    expect(paintBucket(z.get('Inner')!)).toBe(paintBucket(z.get('Ref')!));
  });

  it('RED: a leaf CanvasItem sitting directly in a tree-order slot lands between the y-sort subtrees', async () => {
    // `Mid`, a leaf Polygon2D between two y-sort subtrees under the non-y-sort root, sits
    // in its tree-order slot: behind SubB and in front of SubA, though SubA's item has a
    // higher Y. A leaf goes through CanvasItem2D, not Node2D, so the slot base applies there.
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
 * The container rules, measured on real Godot 4.6.3 with `pnpm ref:godot
 * scripts/godot-ref/scenes/<scene>.tscn --probe x,y`. The test reads those same
 * files off disk, so a scene edit that invalidates a measurement fails here.
 */
describe('Y-sort container rules (issue #356) — measured against Godot 4.6.3', () => {
  it('a y_sort_enabled node draws its OWN body, at its own rank in the merged sort', async () => {
    // `--probe 600,65` gives rgb(255,255,0): the y-sorted `Sub` container's yellow
    // bar, which nothing else covers. Godot draws it, so must we.
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
    // The container is an item and a recursion step. A whole-node dispatch in place of
    // the recursion would render `SubLow` and `SubHigh` twice.
    const root = await renderTscnRoot(probeScene('ysort-nested-merge.tscn'));
    const names = namedObjects(root).map((o) => o.name);
    for (const name of ['Root', 'YS', 'Sub', 'SubLow', 'SubHigh', 'Mid'])
      expect(names.filter((n) => n === name)).toHaveLength(1);
  });

  it("a y-sorted child's subtree MERGES into the parent's flat sort", async () => {
    // `--probe 400,250` gives rgb(0,255,0): of `SubLow`, `Mid` and `SubHigh`, the
    // highest-Y grandchild `SubHigh` (Y=200) wins over `Mid` (Y=100), one level up.
    // Full order: Sub (Y=0, declared first) ▸ SubLow (Y=0) ▸ Mid (Y=100) ▸ SubHigh (Y=200).
    const z = await paintOrderByName(probeScene('ysort-nested-merge.tscn'));
    for (const n of ['Sub', 'SubLow', 'Mid', 'SubHigh']) expect(z.get(n)).toBeDefined();
    expect(z.get('Sub')!).toBeLessThan(z.get('SubLow')!);
    expect(z.get('SubLow')!).toBeLessThan(z.get('Mid')!);
    expect(z.get('Mid')!).toBeLessThan(z.get('SubHigh')!);
  });

  it('a merged item keeps the transform of the y-sorted levels it was lifted past', async () => {
    // `Leaf` (Y=100) under a y-sorted `Sub` (Y=200) keeps Sub's 200 when merged:
    // `--probe 350,480` gives rgb(0,255,0), `--probe 350,150` gives rgb(76,76,76),
    // and `--probe 350,380` gives rgb(0,255,0), in front of `Ref` (Y=250).
    const root = await renderTscnRoot(probeScene('ysort-nested-transform.tscn'));
    const byName = new Map(namedObjects(root).map((o) => [o.name, o]));
    const world = new THREE.Vector3();
    byName.get('Leaf')!.getWorldPosition(world);
    // Godot (0, 300) is three (0, −300): the whole Root→Sub→Leaf chain composed.
    expect(world.y).toBeCloseTo(-300);
    // …and it sorts in front of `Ref` (Y=250), which only the accumulated Y=300
    // does. Draw order is the group's paint key, not its z (`canvasPaintOrder`).
    expect(byName.get('Leaf')!.renderOrder).toBeGreaterThan(byName.get('Ref')!.renderOrder);
  });

  it('GUARDRAIL: a NON-y-sorted container stays one atomic unit at its own Y', async () => {
    // Same tree, container not y-sorted: `--probe 400,250` gives rgb(0,0,255), the
    // mid-Y sibling. `Deco` sorts as one unit at its Y (0), so its high-Y child
    // never overtakes `Mid`. Inside the unit, tree order rules.
    const z = await paintOrderByName(probeScene('ysort-atomic-container.tscn'));
    for (const n of ['Low', 'High', 'Mid']) expect(z.get(n)).toBeDefined();
    expect(z.get('Low')!).toBeLessThanOrEqual(z.get('High')!);
    expect(z.get('High')!).toBeLessThan(z.get('Mid')!);
  });
});
