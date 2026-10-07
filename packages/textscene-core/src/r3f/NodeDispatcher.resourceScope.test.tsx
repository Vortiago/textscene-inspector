/**
 * Each property of an instanced sub-scene resolves both kinds of id against the scene that
 * wrote it: a grafted node's and an override's in the host, the sub-scene's own in the
 * sub-scene. Ids are per file, and a hand-written scene numbers from 1, so they
 * collide readily. Only a collision tells the scopes apart: the provider inherits the
 * ambient pool, and the wrong `1` still parses and draws.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode, TscnScene } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { TscnParser } from '../parser/TscnParser';
import { SceneStack } from './testing/SceneStack';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { initGlbModules } from '../resources/processing/glbProcessing';

import './nodes/index';

beforeAll(async () => {
  await initGlbModules();
});

const SUB_SCENE = 'res://sub.tscn';

/** The instanced scene: one root, and a `1` of its own that must NOT win. */
function subScene(): TscnScene {
  return {
    nodes: [
      {
        name: 'SubRoot',
        type: 'Node3D',
        children: [{ name: 'Anchor', type: 'Node3D', children: [], properties: { name: 'Anchor' } }],
        properties: { name: 'SubRoot' },
      },
    ],
    externalResources: [],
    internalResources: [
      // Same id, different resource: blue.
      { id: '1', type: 'StandardMaterial3D', data: { albedo_color: 'Color(0, 0, 1, 1)' } },
    ],
  };
}

/** The host's deep child, parented INSIDE the instance at `Anchor`. */
function hostGraftedMesh(): TscnNode {
  return {
    name: 'Painted',
    type: 'MeshInstance3D',
    children: [],
    instanceSubPath: 'Anchor',
    properties: {
      name: 'Painted',
      mesh: 'SubResource("Box")',
      // Authored in the HOST, so this `1` is the host's RED one.
      materialOverride: 'SubResource("1")',
      surfaceMaterialOverrides: new Map(),
    },
  };
}

async function render() {
  const fake = createFakeResourceLoader();
  fake.scenes.seed(SUB_SCENE, subScene());

  const instancing: TscnNode = {
    name: 'Instanced',
    type: 'Node3D',
    instance: 'ExtResource("sub")',
    children: [hostGraftedMesh()],
    properties: { name: 'Instanced' },
  };

  return ReactThreeTestRenderer.create(
    <SceneStack
      loader={fake.loader}
      scene={{
        internalResources: [
          { id: 'Box', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } },
          { id: '1', type: 'StandardMaterial3D', data: { albedo_color: 'Color(1, 0, 0, 1)' } },
        ],
        externalResources: [{ id: 'sub', path: SUB_SCENE, type: 'PackedScene' }],
      }}
    >
      <NodeDispatcher nodes={[instancing]} />
    </SceneStack>
  );
}

describe('a grafted node resolves SubResource ids against its authoring scene', () => {
  it('takes the HOST material when both scenes declare the same id', async () => {
    const renderer = await render();

    const mesh = renderer.scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .find((m) => m.name === 'Painted');
    expect(mesh, 'the grafted mesh should render').toBeDefined();

    const material = (
      Array.isArray(mesh!.material) ? mesh!.material[0] : mesh!.material
    ) as THREE.MeshStandardMaterial;
    const linear = material.color.getRGB({ r: 0, g: 0, b: 0 } as THREE.Color, THREE.LinearSRGBColorSpace);

    expect(linear.r).toBeCloseTo(1, 5);
    expect(linear.b).toBeCloseTo(0, 5);
  });
});

/** The instanced scene as a file: `Painted` draws the sub-scene's BLUE `1`, and so does its child `Inner`. */
const SUB_SCENE_TEXT = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="Box"]

[sub_resource type="StandardMaterial3D" id="1"]
albedo_color = Color(0, 0, 1, 1)

[node name="SubRoot" type="MeshInstance3D"]
mesh = SubResource("Box")
material_override = SubResource("1")

[node name="Anchor" type="Node3D" parent="."]

[node name="Painted" type="MeshInstance3D" parent="Anchor"]
mesh = SubResource("Box")
material_override = SubResource("1")

[node name="Inner" type="MeshInstance3D" parent="Anchor/Painted"]
mesh = SubResource("Box")
material_override = SubResource("1")
`;

/** The host as a file, `overrides` appended: its own `1` is RED. */
function hostText(overrides: string): string {
  return `[gd_scene format=3]

[ext_resource type="PackedScene" path="${SUB_SCENE}" id="sub"]

[sub_resource type="StandardMaterial3D" id="1"]
albedo_color = Color(1, 0, 0, 1)

[node name="Instanced" instance=ExtResource("sub")]
${overrides}`;
}

async function renderOverride(overrides: string) {
  const fake = createFakeResourceLoader();
  fake.scenes.seed(SUB_SCENE, new TscnParser().parse(SUB_SCENE_TEXT));
  const host = new TscnParser().parse(hostText(overrides));

  return ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={host}>
      <NodeDispatcher nodes={host.nodes} />
    </SceneStack>
  );
}

/** The linear red and blue of the mesh named `name`. */
function colourOf(
  renderer: Awaited<ReturnType<typeof renderOverride>>,
  name: string
): { r: number; b: number } {
  const mesh = renderer.scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => m.name === name);
  expect(mesh, `${name} should render`).toBeDefined();
  const material = (
    Array.isArray(mesh!.material) ? mesh!.material[0] : mesh!.material
  ) as THREE.MeshStandardMaterial;
  const { r, b } = material.color.getRGB({ r: 0, g: 0, b: 0 } as THREE.Color, THREE.LinearSRGBColorSpace);
  return { r, b };
}

describe('an override resolves only the properties it authored in the host', () => {
  it('keeps the sub-scene material of a node whose override sets something else', async () => {
    const renderer = await renderOverride('\n[node name="Painted" parent="Anchor"]\nvisible = true\n');

    expect(colourOf(renderer, 'Painted').b).toBeCloseTo(1, 5);
  });

  it('takes the host material an override sets', async () => {
    const renderer = await renderOverride(
      '\n[node name="Painted" parent="Anchor"]\nmaterial_override = SubResource("1")\n'
    );

    expect(colourOf(renderer, 'Painted').r).toBeCloseTo(1, 5);
  });

  it('keeps the sub-scene material below an overridden node', async () => {
    const renderer = await renderOverride(
      '\n[node name="Painted" parent="Anchor"]\nmaterial_override = SubResource("1")\n'
    );

    expect(colourOf(renderer, 'Inner').b).toBeCloseTo(1, 5);
  });

  it('takes the host material the instance node itself sets on the sub-scene root', async () => {
    const renderer = await renderOverride('material_override = SubResource("1")\n');

    expect(colourOf(renderer, 'Instanced').r).toBeCloseTo(1, 5);
  });
});
