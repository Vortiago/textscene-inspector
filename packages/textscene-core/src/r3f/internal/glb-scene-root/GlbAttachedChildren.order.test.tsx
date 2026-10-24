/**
 * A typed node attached to a GLB object takes its place among that object's children as Godot
 * adds it: at the end, then moved to its `index=` (`packed_scene.cpp:541-545`). The GLB object's own
 * children are already there, since the instanced scene is built first. The viewport gives the
 * attached nodes that tree order, as the scene tree lists them.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { NodeDispatcher } from '../../NodeDispatcher';
import { nodeComponentRegistry, type NodeComponentProps } from '../../NodeComponentRegistry';
import { compareTreeOrder, useTreeOrder, type TreeOrder } from '../../contexts/TreeOrderContext';
import { TscnParser } from '../../../parser/TscnParser';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { seedGlbInstance } from '../../../resources/testing/seedGlbInstance';
import { SceneStack } from '../../testing/SceneStack';
import { settleLoads } from '../../testing/settleLoads';

import '../../nodes/index';

const GLB_PATH = 'res://rig.glb';

/** Written by each `OrderProbe` as it renders, by node name. Emptied by `treeOrdersOf`. */
const probedOrders = new Map<string, TreeOrder>();

function OrderProbe({ node }: NodeComponentProps) {
  probedOrders.set(node.name, useTreeOrder());
  return null;
}
nodeComponentRegistry.register({ typeName: 'OrderProbe', Component: OrderProbe });

/** Two probes attached to the GLB object `Body`, `B` written second with the given `index=`. */
const sceneWith = (bIndex: string) => `[gd_scene format=3]

[ext_resource type="PackedScene" path="${GLB_PATH}" id="1"]

[node name="Root" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="A" type="OrderProbe" parent="Rig/Body"]

[node name="B" type="OrderProbe" parent="Rig/Body"${bIndex}]
`;

/** A GLB whose object `Body` holds one object of its own. */
function rigGlb(): THREE.Object3D {
  const named = (name: string) => Object.assign(new THREE.Group(), { name });
  const root = named('Scene');
  const body = named('Body');
  body.add(named('Part'));
  root.add(body);
  return root;
}

/** Negative when `A` enters the tree before `B`. */
async function treeOrderOfAAgainstB(source: string): Promise<number> {
  probedOrders.clear();
  const scene = new TscnParser().parse(source);
  const fake = createFakeResourceLoader();
  seedGlbInstance(fake, GLB_PATH, rigGlb());
  await ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={scene}>
      <NodeDispatcher nodes={scene.nodes} />
    </SceneStack>
  );
  await settleLoads();
  const a = probedOrders.get('A');
  const b = probedOrders.get('B');
  if (!a || !b) throw new Error(`expected both probes to render, got ${[...probedOrders.keys()]}`);
  return compareTreeOrder(a, b);
}

describe('the tree order of typed nodes attached to a GLB object', () => {
  it('follows the file order when no node states an index', async () => {
    expect(await treeOrderOfAAgainstB(sceneWith(''))).toBeLessThan(0);
  });

  it('puts a node that states index=0 before the node written above it', async () => {
    expect(await treeOrderOfAAgainstB(sceneWith(' index="0"'))).toBeGreaterThan(0);
  });

  it("puts a node at index=1 after the object's own child, before the node written above it", async () => {
    expect(await treeOrderOfAAgainstB(sceneWith(' index="1"'))).toBeGreaterThan(0);
  });

  it('keeps a node whose index is past the last place after the node written above it (edge case)', async () => {
    expect(await treeOrderOfAAgainstB(sceneWith(' index="2"'))).toBeLessThan(0);
  });
});
