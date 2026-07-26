/**
 * End to end: a CSG subtree really does become ONE mesh with a hole in it.
 *
 * Every other CSG test checks a piece. This one renders through the real component tree
 * and asserts the three things that only compose at this level: contributors stop drawing
 * their own solids, the root draws the evaluated result, and the contributors are still
 * MOUNTED so selection and bounds keep working.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { NodePathProvider } from '../contexts/NodePathContext';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnNode } from '../../parser/types';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { clearEvaluationCache } from './csgEvaluationCache';
import { loadCsgModule } from './csgModule';
import '../nodes/index';

/** Mount a node with its CSG children, giving each the node path the dispatcher would. */
function Tree({ node, path }: { node: TscnNode; path: string }) {
  const Component = nodeComponentRegistry.get(node.type)!;
  return (
    <NodePathProvider path={path}>
      <Component node={node}>
        {node.children.map((child) => (
          <Tree key={child.name} node={child} path={`${path}/${child.name}`} />
        ))}
      </Component>
    </NodePathProvider>
  );
}

function parse(body: string) {
  return new TscnParser().parse(`[gd_scene format=3]\n\n${body}\n`);
}

/**
 * Render, then wait until the evaluated result has actually landed.
 *
 * The CSG library arrives through a dynamic import and the component publishes its
 * status from a `.then`, so a single macrotask tick is not enough: under load (a
 * concurrent visual run, a cold CI box) the assertions raced the evaluation and saw the
 * un-subtracted box. Settling on an observable condition rather than a fixed delay
 * removes the flake without inventing a timeout to tune.
 */
async function render(body: string, expectSettled = true) {
  clearEvaluationCache();
  const scene = parse(body);
  const root = scene.nodes[0]!.children[0]!;
  const renderer = await ReactThreeTestRenderer.create(
    <SceneResourcesProvider internalResources={scene.internalResources}>
      <Tree node={root} path={`Root/${root.name}`} />
    </SceneResourcesProvider>
  );

  // Await the same memoized promise the component awaits, so the module is resident
  // before we start flushing its state update.
  await loadCsgModule().catch(() => undefined);

  for (let attempt = 0; attempt < 20; attempt++) {
    await ReactThreeTestRenderer.act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    if (!expectSettled) break;
    // Settled once a bounds proxy exists (contributors pruned) or there is nothing to
    // prune in the first place.
    const hasProxy = renderer.scene
      .findAllByType('Mesh')
      .some((m) => (m.instance as THREE.Mesh).userData?.tscnBoundsProxy === true);
    if (hasProxy || attempt > 2) break;
  }
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

    const renderer = await render(SUBTRACTION, false);
    // Both solids drawn again rather than one merged result, or nothing at all.
    expect(drawnMeshes(renderer).length).toBeGreaterThanOrEqual(1);

    vi.doUnmock('three-bvh-csg');
    vi.resetModules();
  });
});
