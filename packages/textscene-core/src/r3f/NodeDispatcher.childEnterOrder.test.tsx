/**
 * The order in which the dispatcher places two SubViewports, VA and VB, whose tree order an `index=`
 * changes. Godot enters children in the order it adds them (`node.cpp:371`) and moves a child to its
 * `index=` only after the add (`packed_scene.cpp:541-544`), so its viewports draw in add order. The
 * scenes come from the Godot comparison of the viewport pass order, each with the order Godot draws.
 */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect } from 'react';

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

import './nodes/index';

const GLB_PATH = 'res://rig.glb';
const SUB_PATH = 'res://model.tscn';
const BASE_PATH = 'res://base.tscn';

const SUB_SCENE = `[gd_scene format=3]

[node name="Model" type="Node3D"]

[node name="Cube" type="Node3D" parent="."]
`;

const BASE_SCENE = `[gd_scene format=3]

[node name="Root" type="Control"]

[node name="Outer" type="SubViewport" parent="."]

[node name="FromVA" type="TextureRect" parent="Outer"]
`;

/** A scene whose `Outer` holds `model`, then the two headings in `viewports`, in that order. */
function sceneWith(model: string, viewports: string): string {
  return `[gd_scene format=3]

[ext_resource type="PackedScene" path="${GLB_PATH}" id="1_glb"]

[ext_resource type="PackedScene" path="${SUB_PATH}" id="1_sub"]

[node name="Root" type="Control"]

[node name="Outer" type="SubViewport" parent="."]

${model}

${viewports}
`;
}

const VA_BELOW_MODEL = '[node name="VA" type="SubViewport" parent="Outer/Model"]';
const VB_FIRST_BELOW_MODEL = '[node name="VB" type="SubViewport" parent="Outer/Model" index="0"]';

interface EnterOrderCase {
  name: string;
  source: string;
  /** The viewport the dispatcher places first today. */
  placedFirst: 'VA' | 'VB';
  /** The viewport Godot draws first, measured against Godot 4.6.3. */
  godotFirst: 'VA' | 'VB';
}

const CASES: readonly EnterOrderCase[] = [
  {
    name: 'below a GLB instance, VB moved first by index= after VA',
    source: sceneWith(
      '[node name="Model" parent="Outer" instance=ExtResource("1_glb")]',
      `${VA_BELOW_MODEL}\n\n${VB_FIRST_BELOW_MODEL}`
    ),
    placedFirst: 'VA',
    godotFirst: 'VA',
  },
  {
    name: 'below a .tscn instance, VB moved first by index= after VA',
    source: sceneWith(
      '[node name="Model" parent="Outer" instance=ExtResource("1_sub")]',
      `${VA_BELOW_MODEL}\n\n${VB_FIRST_BELOW_MODEL}`
    ),
    placedFirst: 'VA',
    godotFirst: 'VA',
  },
  {
    name: 'below an inherited scene, VB moved before VA by index= after VA',
    source: `[gd_scene format=3]

[ext_resource type="PackedScene" path="${BASE_PATH}" id="1_base"]

[node name="Root" instance=ExtResource("1_base")]

[node name="VA" type="SubViewport" parent="Outer"]

[node name="VB" type="SubViewport" parent="Outer" index="1"]
`,
    placedFirst: 'VA',
    godotFirst: 'VA',
  },
  // A hand-written shape: a child without index= written after one with it. Godot adds VB first.
  // The dispatcher places the unmoved VA first until it orders children by their add sequence.
  {
    name: 'below a .tscn instance, VB written first with index=, VA after it without one',
    source: sceneWith(
      '[node name="Model" parent="Outer" instance=ExtResource("1_sub")]',
      `${VB_FIRST_BELOW_MODEL}\n\n${VA_BELOW_MODEL}`
    ),
    placedFirst: 'VA',
    godotFirst: 'VB',
  },
  {
    name: 'below a parent of its own file, VB written first with index=, VA after it without one',
    source: sceneWith(
      '[node name="FromVA" type="TextureRect" parent="Outer"]',
      '[node name="VB" type="SubViewport" parent="Outer" index="0"]\n\n[node name="VA" type="SubViewport" parent="Outer"]'
    ),
    placedFirst: 'VA',
    godotFirst: 'VB',
  },
];

const NO_OP_PASS = { dependsOn: [], render: () => {} };

/** Registers a pass at `path`, so the registry sorts it by the placement the dispatcher gives. */
function Registrar({ path }: { path: string }) {
  const register = useRegisterViewportPass();
  useEffect(() => register(path, NO_OP_PASS), [register, path]);
  return null;
}

/** Every path the dispatcher may give VA and VB, with and without the root's name. */
const PROBE_PATHS = ['Outer/Model', 'Outer'].flatMap((parent) =>
  ['VA', 'VB'].flatMap((name) => [`${parent}/${name}`, `Root/${parent}/${name}`])
);

function glbWithOneObject(): THREE.Object3D {
  const root = new THREE.Group();
  root.add(Object.assign(new THREE.Group(), { name: 'Object0' }));
  return root;
}

/** The last tree order the registry sorted the placed pass named `name` by. */
function lastTreeOrderOf(name: string): readonly number[] {
  const last = placedOrders.at(-1) ?? [];
  const pass = last.find(({ id, treeOrder }) => id.endsWith(`/${name}`) && treeOrder);
  if (!pass?.treeOrder) throw new Error(`expected a placed pass for ${name}, found ${JSON.stringify(last)}`);
  return pass.treeOrder;
}

async function placedFirstIn(source: string): Promise<'VA' | 'VB'> {
  const parser = new TscnParser();
  const scene = parser.parse(source);
  const fake = createFakeResourceLoader();
  seedGlbInstance(fake, GLB_PATH, glbWithOneObject());
  fake.scenes.seed(SUB_PATH, parser.parse(SUB_SCENE));
  fake.scenes.seed(BASE_PATH, parser.parse(BASE_SCENE));
  await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={scene}>
      <ViewportPassProvider>
        <NodeDispatcher nodes={scene.nodes} />
        {PROBE_PATHS.map((path) => (
          <Registrar key={path} path={path} />
        ))}
      </ViewportPassProvider>
    </SceneStack>
  );
  await settleLoads();
  return compareTreeOrder(lastTreeOrderOf('VA'), lastTreeOrderOf('VB')) < 0 ? 'VA' : 'VB';
}

describe('the order the dispatcher places viewports that index= moves', () => {
  it.each(CASES)('$name: places $placedFirst first, Godot draws $godotFirst first', async (c) => {
    expect(await placedFirstIn(c.source)).toBe(c.placedFirst);
  });
});
