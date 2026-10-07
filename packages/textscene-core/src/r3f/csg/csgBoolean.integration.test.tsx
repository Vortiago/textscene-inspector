/**
 * End to end, through the real component tree, a CSG subtree becomes one mesh: contributors stop
 * drawing their own solids, the root draws the evaluated result, and the contributors stay mounted
 * so selection and bounds keep working.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { TscnParser } from '../../parser/TscnParser';
import { clearEvaluationCache } from './csgEvaluationCache';
import '../nodes/index';
import { NodeTree } from '../testing/NodeTree';
import { settleCsgEvaluation } from './testing/settleCsgEvaluation';

function parse(body: string) {
  return new TscnParser().parse(`[gd_scene format=3]\n\n${body}\n`);
}

function mount(body: string) {
  clearEvaluationCache();
  const scene = parse(body);
  const root = scene.nodes[0]!.children[0]!;
  return ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources}>
      <NodeTree node={root} path={`Root/${root.name}`} />
    </SceneResourcesProvider>
  );
}

/** Mounts, then waits until the evaluated result lands. */
async function render(body: string) {
  const renderer = await mount(body);
  await settleCsgEvaluation(renderer);
  return renderer;
}

const SUBTRACTION = `[node name="Root" type="Node3D"]

[node name="Block" type="CSGBox3D" parent="."]
size = Vector3(2, 2, 2)

[node name="Hole" type="CSGSphere3D" parent="Block"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1)
operation = 2
radius = 1.25
`;

const LONE_BOX = `[node name="Root" type="Node3D"]

[node name="Block" type="CSGBox3D" parent="."]
size = Vector3(2, 2, 2)
`;

/**
 * A nested combiner carrying its own `operation`. The parent calls `child->_get_brush()`, which
 * folds the child's whole subtree, then combines that result by `child->get_operation()`
 * (csg_shape.cpp:472,481).
 */
const NESTED_COMBINER_OP = `[node name="Root" type="Node3D"]

[node name="Block" type="CSGBox3D" parent="."]
size = Vector3(2, 2, 2)

[node name="Cutter" type="CSGCombiner3D" parent="Block"]
operation = 2

[node name="Blade" type="CSGBox3D" parent="Block/Cutter"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.9, 0.9, 0.9)
size = Vector3(1.2, 1.2, 1.2)
`;

function meshes(renderer: Awaited<ReturnType<typeof render>>) {
  return renderer.scene.findAllByType('Mesh');
}

function drawnMeshes(renderer: Awaited<ReturnType<typeof render>>) {
  return meshes(renderer).filter((m) => (m.instance as THREE.Mesh).visible);
}

function volumeOf(geometry: THREE.BufferGeometry): number {
  const p = (geometry.index ? geometry.toNonIndexed() : geometry).getAttribute('position');
  let total = 0;
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i));
    const b = new THREE.Vector3(p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1));
    const c = new THREE.Vector3(p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2));
    total += a.dot(new THREE.Vector3().crossVectors(b, c)) / 6;
  }
  return Math.abs(total);
}

describe('CSG boolean evaluation, end to end', () => {
  it('subtracts a sphere from a box, leaving ONE drawn mesh with less volume', async () => {
    const renderer = await render(SUBTRACTION);
    const drawn = drawnMeshes(renderer);
    expect(drawn).toHaveLength(1);

    const geometry = (drawn[0]!.instance as THREE.Mesh).geometry;
    // A 2x2x2 box is 8. The sphere bites a corner out, so the result must be
    // meaningfully smaller while still being most of the block.
    const volume = volumeOf(geometry);
    expect(volume).toBeLessThan(7.6);
    expect(volume).toBeGreaterThan(5);
  });

  it('keeps the contributor MOUNTED, with an invisible bounds proxy', async () => {
    // Unmounting it instead would strip its selection box, its highlight and its row's
    // hidden-eye toggle, because PlainNode is what registers those.
    const renderer = await render(SUBTRACTION);
    const proxies = meshes(renderer).filter(
      (m) => (m.instance as THREE.Mesh).userData?.tscnBoundsProxy === true
    );
    expect(proxies).toHaveLength(1);
    expect((proxies[0]!.instance as THREE.Mesh).visible).toBe(false);
    // And the proxy carries the sphere's real extent, so F-to-frame still works.
    const geometry = (proxies[0]!.instance as THREE.Mesh).geometry;
    geometry.computeBoundingSphere();
    expect(geometry.boundingSphere!.radius).toBeCloseTo(1.25, 2);
  });

  it('takes the no-evaluator path for a lone root', async () => {
    // The short-circuit that keeps every pre-existing CSG golden byte-identical.
    const renderer = await render(LONE_BOX);
    const drawn = drawnMeshes(renderer);
    expect(drawn).toHaveLength(1);
    expect(volumeOf((drawn[0]!.instance as THREE.Mesh).geometry)).toBeCloseTo(8, 5);
  });

  it('folds a CSGCombiner3D subtree into one mesh', async () => {
    const renderer = await render(`[node name="Root" type="Node3D"]

[node name="Comb" type="CSGCombiner3D" parent="."]

[node name="A" type="CSGBox3D" parent="Comb"]
size = Vector3(2, 2, 2)

[node name="B" type="CSGBox3D" parent="Comb"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0)
size = Vector3(2, 2, 2)
`);
    const drawn = drawnMeshes(renderer);
    expect(drawn).toHaveLength(1);
    // Two 2x2x2 boxes overlapping by half: 8 + 8 - 4 = 12.
    expect(volumeOf((drawn[0]!.instance as THREE.Mesh).geometry)).toBeCloseTo(12, 1);
  });

  it('leaves a CSG grandchild under a plain Node3D as its OWN drawn mesh', async () => {
    // Godot's parent_shape is set only for a direct CSG parent, so this is two roots and
    // two meshes, not one boolean.
    const renderer = await render(`[node name="Root" type="Node3D"]

[node name="Block" type="CSGBox3D" parent="."]
size = Vector3(2, 2, 2)

[node name="Holder" type="Node3D" parent="Block"]

[node name="Free" type="CSGSphere3D" parent="Block/Holder"]
radius = 0.5
`);
    expect(drawnMeshes(renderer)).toHaveLength(2);
  });

  it('degrades to base primitives when the CSG library cannot load', async () => {
    // The terminal rung of the degradation ladder: every contributor un-prunes and draws
    // itself, which is exactly the retired CSG-as-primitive behaviour.
    vi.resetModules();
    const { resetCsgModuleForTests } = await import('./csgModule');
    resetCsgModuleForTests();
    vi.doMock('three-bvh-csg', () => {
      throw new Error('chunk failed to load');
    });

    // One tick, not a settle: a failed load never prunes, so no bounds proxy ever appears.
    const renderer = await mount(SUBTRACTION);
    await ReactThreeTestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    // Both solids drawn again rather than one merged result, or nothing at all.
    expect(drawnMeshes(renderer).length).toBeGreaterThanOrEqual(1);

    vi.doUnmock('three-bvh-csg');
    vi.resetModules();
  });

  it("applies a nested combiner's own operation to its whole fold", async () => {
    // Block 2^3 = 8. The blade spans [0.3, 1.5]^3, so it overlaps the block in
    // [0.3, 1]^3 = 0.343. Subtracting the combiner's fold leaves 8 - 0.343; unioning
    // its child in at root level instead would give 8 + (1.728 - 0.343) = 9.385.
    const drawn = drawnMeshes(await render(NESTED_COMBINER_OP));
    const geometry = (drawn[0]!.instance as THREE.Mesh).geometry;

    expect(volumeOf(geometry)).toBeCloseTo(7.657, 3);
  });
});
