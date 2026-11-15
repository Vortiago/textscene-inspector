/**
 * The host children of a GLB instance take their place in tree order from the file, not from an
 * `index=`. Godot enters children in the order it adds them (`node.cpp:371`) and moves a child to
 * its `index=` only after that, so the viewport passes draw in file order.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

const placedOrders = vi.hoisted(() => [] as { id: string; treeOrder: readonly number[] | null }[][]);
vi.mock('../nodes/viewport/passOrder.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../nodes/viewport/passOrder.js')>();
  return {
    ...actual,
    orderViewportPasses: (passes: Parameters<typeof actual.orderViewportPasses>[0]) => {
      placedOrders.push(passes.map(({ id, treeOrder }) => ({ id, treeOrder })));
      return actual.orderViewportPasses(passes);
    },
  };
});

import { NodeDispatcher } from './NodeDispatcher';
import { TscnParser } from '../parser/TscnParser';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { seedGlbInstance } from '../resources/testing/seedGlbInstance';
import { SceneStack } from './testing/SceneStack';
import { settleLoads } from './testing/settleLoads';
import { compareTreeOrder } from './contexts/treeOrder';
import { ViewportPassProvider, useRegisterViewportPass } from './contexts/ViewportPassRegistryContext';
import { useEffect } from 'react';

import './nodes/index';

const GLB_PATH = 'res://rig.glb';

/** Two SubViewports below a GLB instance: `VB` is written second and moved first by `index="0"`. */
const SCENE = `[gd_scene format=3]

[ext_resource type="PackedScene" path="${GLB_PATH}" id="1"]

[node name="Root" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("1")]

[node name="VA" type="SubViewport" parent="Rig"]

[node name="VB" type="SubViewport" parent="Rig" index="0"]
`;

const NO_OP_PASS = { dependsOn: [], render: () => {} };

/** Registers a pass at `path`, so the registry sorts it by the placement the dispatcher gives. */
function Registrar({ path }: { path: string }) {
  const register = useRegisterViewportPass();
  useEffect(() => register(path, NO_OP_PASS), [register, path]);
  return null;
}

function glbWithOneObject(): THREE.Object3D {
  const root = new THREE.Group();
  root.add(Object.assign(new THREE.Group(), { name: 'Object0' }));
  return root;
}

/** The last tree order the registry sorted the pass whose id ends in `name` by. */
function lastTreeOrderOf(name: string): readonly number[] {
  const last = placedOrders.at(-1) ?? [];
  const pass = last.find(({ id, treeOrder }) => id.endsWith(`/${name}`) && treeOrder);
  if (!pass?.treeOrder) throw new Error(`expected a placed pass for ${name}, found ${JSON.stringify(last)}`);
  return pass.treeOrder;
}

describe('the viewport placement of the host children of a GLB instance', () => {
  it('follows the file order, not the index= move', async () => {
    const scene = new TscnParser().parse(SCENE);
    const fake = createFakeResourceLoader();
    seedGlbInstance(fake, GLB_PATH, glbWithOneObject());
    await ReactThreeTestRenderer.create(
      <SceneStack workspace="3d" loader={fake.loader} scene={scene}>
        <ViewportPassProvider>
          <NodeDispatcher nodes={scene.nodes} />
          {['Root/Rig/VA', 'Root/Rig/VB', 'Rig/VA', 'Rig/VB'].map((path) => (
            <Registrar key={path} path={path} />
          ))}
        </ViewportPassProvider>
      </SceneStack>
    );
    await settleLoads();

    expect(compareTreeOrder(lastTreeOrderOf('VA'), lastTreeOrderOf('VB'))).toBeLessThan(0);
  });
});
