/**
 * A host child of a lone GLB instance that states `index=` moves to that place among the node's
 * children, which start with the GLB's top-level objects (`packed_scene.cpp:261-264`, `:541-544`).
 * The viewport paints the host children in that order, as the tree lists them.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from './NodeDispatcher';
import { TscnParser } from '../parser/TscnParser';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { seedGlbInstance } from '../resources/testing/seedGlbInstance';
import { SceneStack } from './testing/SceneStack';
import { settleLoads } from './testing/settleLoads';
import { nearestGroupOrder } from './testing/paintOrder';

import './nodes/index';

const GLB_PATH = 'res://rig.glb';

/** Two 2D host children below a GLB instance, `B` written second and moved to the index `bIndex`. */
const sceneWith = (bIndex: string) => `[gd_scene format=3]

[ext_resource type="PackedScene" path="${GLB_PATH}" id="1"]

[node name="Root" type="Node2D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="A" type="Polygon2D" parent="Rig"]
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)

[node name="B" type="Polygon2D" parent="Rig"${bIndex}]
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
`;

/** The GLB has `objectCount` top-level objects. */
function glbWith(objectCount: number): THREE.Object3D {
  const root = new THREE.Group();
  for (let i = 0; i < objectCount; i++) root.add(Object.assign(new THREE.Group(), { name: `Object${i}` }));
  return root;
}

/** Where three sorts the named node's mesh: its group's order, then its own (`paintOrder.ts`). */
function paintKeyOf(
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>,
  name: string
): readonly [number, number] {
  let mesh: THREE.Object3D | undefined;
  renderer.scene.instance.getObjectByName(name)?.traverse((o) => {
    if (!mesh && (o as THREE.Mesh).isMesh) mesh = o;
  });
  if (!mesh) throw new Error(`expected "${name}" to draw a mesh, found none`);
  return [nearestGroupOrder(mesh), mesh.renderOrder];
}

/** Whether `first` paints under `second`: three sorts by group order, then render order. */
function paintsBefore(first: readonly [number, number], second: readonly [number, number]): boolean {
  return first[0] === second[0] ? first[1] < second[1] : first[0] < second[0];
}

async function paintOrderOf(source: string, objectCount: number) {
  const scene = new TscnParser().parse(source);
  const fake = createFakeResourceLoader();
  seedGlbInstance(fake, GLB_PATH, glbWith(objectCount));
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={scene}>
      <NodeDispatcher nodes={scene.nodes} />
    </SceneStack>
  );
  await settleLoads();
  return { a: paintKeyOf(renderer, 'A'), b: paintKeyOf(renderer, 'B') };
}

describe('the paint order of the host children of a lone GLB instance', () => {
  it('follows the file order when no child states an index', async () => {
    const { a, b } = await paintOrderOf(sceneWith(''), 2);

    expect(paintsBefore(a, b)).toBe(true);
  });

  it('puts a child that states index=0 before the child written above it', async () => {
    const { a, b } = await paintOrderOf(sceneWith(' index="0"'), 2);

    expect(paintsBefore(b, a)).toBe(true);
  });

  it('keeps a child whose index is past the GLB objects after the child written above it', async () => {
    const { a, b } = await paintOrderOf(sceneWith(' index="2"'), 1);

    expect(paintsBefore(a, b)).toBe(true);
  });
});
