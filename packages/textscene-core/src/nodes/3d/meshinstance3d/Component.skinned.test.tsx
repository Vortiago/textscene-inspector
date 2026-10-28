/**
 * A MeshInstance3D bound to a Skeleton3D draws a surface with bone arrays skinned: each vertex is
 * the weighted sum of its bones' skin matrices, in mesh space, and the node's own transform applies
 * after (`skeleton.glsl:248-291`). A surface without bone arrays stays unskinned even when bound
 * (`mesh_storage.cpp:1213`).
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TscnParser } from '../../../parser/TscnParser';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import type { TscnNode } from '../../../parser/types';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { subResource } from '../../../testing/subResource';
import { transform3DToMatrix } from '../../../r3f/nodeTreeTransforms';
import { instanceAs } from '../testing/reactThreeTestInstance';
import type { Bone } from '../skeleton3d/skeletonPose';
import { poseSkeleton } from '../skeleton3d/skeletonPose';
import '../skeleton3d/index';
import '../skeleton3d/index.r3f';
import './index';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { meshInstanceNode, meshInstanceTree, renderMeshInstance } from './testing/renderMeshInstance';
import type { MeshInstance3DProperties } from './types';

/** The six chained bones of `unit-mesh-instance-3d-skinned-ribbon.tscn`: b2 turned 60 degrees about Z. */
function ribbonBones(): Bone[] {
  const chain = [0.5, -0.2, -0.2, -0.2, -0.2, -0.2].map((y, i) => ({
    name: `b${i}`,
    parent: i - 1,
    rest: translation(y),
    enabled: true,
    position: { x: 0, y, z: 0 },
    rotation: i === 2 ? { x: 0, y: 0, z: 0.5, w: 0.866025 } : { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  }));
  return chain;
}

function translation(y: number) {
  return {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x: 0, y, z: 0 },
  };
}

const RIBBON = subResource('RibbonTrailMesh', 'Ribbon', {
  shape: '0',
  size: '0.4',
  material: 'SubResource("Red")',
});
const RED = subResource('StandardMaterial3D', 'Red', { albedo_color: 'Color(1, 0, 0, 1)' });
const OVERLAY = subResource('StandardMaterial3D', 'Overlay', { albedo_color: 'Color(0, 0, 1, 1)' });
const BOX = subResource('BoxMesh', 'Box', { material: 'SubResource("Red")' });

function skinMatrices(bones = ribbonBones()) {
  return poseSkeleton(bones, false).automaticSkinMatrices;
}

async function render(overrides: Partial<MeshInstance3DProperties>, mesh = 'Ribbon') {
  return renderMeshInstance({
    loader: loaderServing(),
    node: meshInstanceNode({ mesh: `SubResource("${mesh}")` }, overrides),
    internalResources: [RIBBON, BOX, RED, OVERLAY],
  });
}

function skinnedMeshes(renderer: Awaited<ReturnType<typeof render>>): THREE.SkinnedMesh[] {
  return renderer.scene.findAllByType('SkinnedMesh').map((m) => instanceAs<THREE.SkinnedMesh>(m));
}

function vertexOf(mesh: THREE.SkinnedMesh, index: number): number[] {
  return mesh.getVertexPosition(index, new THREE.Vector3()).toArray();
}

describe('MeshInstance3D bound to a Skeleton3D', () => {
  it('draws a surface with bone arrays as a SkinnedMesh over the skeleton the pass gave it', async () => {
    const renderer = await render({ skinMatrices: skinMatrices() });

    const [skinned] = skinnedMeshes(renderer);
    expect(skinned!.skeleton.bones).toHaveLength(6);
    expect(renderer.scene.findAllByType('Mesh')).toEqual([]);
  });

  it('leaves the bone matrices as filled once, so the renderer does not skin them again each frame', async () => {
    const [skinned] = skinnedMeshes(await render({ skinMatrices: skinMatrices() }));
    const filled = Array.from(skinned!.skeleton.boneMatrices!);

    skinned!.skeleton.bones[2]!.matrixWorld.makeTranslation(9, 9, 9);
    skinned!.skeleton.update();

    expect(Array.from(skinned!.skeleton.boneMatrices!)).toEqual(filled);
    expect(filled[16 * 2 + 12]).not.toBe(9);
  });

  it('keeps the skeleton when a re-parse hands over the same matrices in a new array', async () => {
    const scene = (matrices: ReturnType<typeof skinMatrices>) => ({
      loader: loaderServing(),
      node: meshInstanceNode({ mesh: 'SubResource("Ribbon")' }, { skinMatrices: matrices }),
      internalResources: [RIBBON, RED],
    });
    const renderer = await ReactThreeTestRenderer.create(meshInstanceTree(scene(skinMatrices())));
    const [before] = skinnedMeshes(renderer as Awaited<ReturnType<typeof render>>);

    await renderer.update(meshInstanceTree(scene(skinMatrices())));
    const [after] = skinnedMeshes(renderer as Awaited<ReturnType<typeof render>>);

    expect(after!.skeleton).toBe(before!.skeleton);
  });

  it('moves each vertex by the matrices of its bones, in mesh space', async () => {
    const [skinned] = skinnedMeshes(await render({ skinMatrices: skinMatrices() }));

    // Row 0 is all b0, which sits at its rest.
    expect(vertexOf(skinned!, 0)).toEqual([-0.2, 0.5, 0].map((v) => expect.closeTo(v, 5)));
    // The last row is all b5, which turns with b2 about (0, 0.1, 0): (0.2, -0.5) swings to
    // (0.6196, -0.0268), a worked rotation of 60 degrees.
    expect(vertexOf(skinned!, 31)).toEqual([0.6196, -0.0268, 0].map((v) => expect.closeTo(v, 3)));
  });

  it('blends the vertices of a row between the two bones its weights name', async () => {
    const [skinned] = skinnedMeshes(await render({ skinMatrices: skinMatrices() }));

    // Row 5 sits two thirds down the section of b1 (which stays) and b2 (which turns 60 degrees
    // about its joint at (0, 0.1)), so it weighs 1/3 on the first and 2/3 on the second.
    const rest = [-0.2, 0.5 - 5 / 15];
    const joint = [0, 0.1];
    const turned = [
      joint[0]! + 0.5 * (rest[0]! - joint[0]!) - 0.866025 * (rest[1]! - joint[1]!),
      joint[1]! + 0.866025 * (rest[0]! - joint[0]!) + 0.5 * (rest[1]! - joint[1]!),
    ];
    const [x, y] = vertexOf(skinned!, 10);
    expect(x).toBeCloseTo(rest[0]! / 3 + (2 * turned[0]!) / 3, 4);
    expect(y).toBeCloseTo(rest[1]! / 3 + (2 * turned[1]!) / 3, 4);
  });

  it("applies the node's own transform after the skin", async () => {
    const renderer = await render({
      skinMatrices: skinMatrices(),
      transform: {
        basis_x: { x: 1, y: 0, z: 0 },
        basis_y: { x: 0, y: 1, z: 0 },
        basis_z: { x: 0, y: 0, z: 1 },
        origin: { x: 3, y: 0, z: 0 },
      },
    });
    const [skinned] = skinnedMeshes(renderer);

    skinned!.updateMatrixWorld(true);
    expect(skinned!.position.x).toBeCloseTo(3, 6);
    // Detached from the skeleton, so the skin matrices stay in mesh space.
    expect(skinned!.bindMode).toBe(THREE.DetachedBindMode);
    expect(vertexOf(skinned!, 0)[0]).toBeCloseTo(-0.2, 5);
  });

  it('feeds the skin matrices to the skeleton one for each bone', async () => {
    const matrices = skinMatrices();
    const [skinned] = skinnedMeshes(await render({ skinMatrices: matrices }));

    skinned!.skeleton.update();
    const bone2 = new THREE.Matrix4().fromArray(skinned!.skeleton.boneMatrices!, 2 * 16);
    expect(bone2.toArray()).toEqual(
      transform3DToMatrix(matrices[2]!)
        .toArray()
        .map((v) => expect.closeTo(v, 5))
    );
  });

  it('draws a surface with no bone arrays unskinned although the node is bound', async () => {
    const renderer = await render({ skinMatrices: skinMatrices() }, 'Box');

    expect(skinnedMeshes(renderer)).toEqual([]);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws a node that binds no skeleton unskinned, at its rest pose', async () => {
    const renderer = await render({});

    expect(skinnedMeshes(renderer)).toEqual([]);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws the material overlay skinned too, over the same skeleton', async () => {
    const renderer = await render({
      skinMatrices: skinMatrices(),
      materialOverlay: 'SubResource("Overlay")',
    });

    const [base, overlay] = skinnedMeshes(renderer);
    expect(overlay).toBeDefined();
    expect(overlay!.skeleton).toBe(base!.skeleton);
    expect(overlay!.bindMode).toBe(THREE.DetachedBindMode);
  });

  it('keeps the surface material on the skinned mesh', async () => {
    const [skinned] = skinnedMeshes(await render({ skinMatrices: skinMatrices() }));

    const material = (
      Array.isArray(skinned!.material) ? skinned!.material[0] : skinned!.material
    ) as THREE.MeshStandardMaterial;
    expect(material.color.r).toBeGreaterThan(0.9);
    expect(material.color.g).toBeLessThan(0.1);
  });

  it('lets a bone past the skin collapse its vertices, as an empty bone buffer does (edge case)', async () => {
    const [skinned] = skinnedMeshes(await render({ skinMatrices: skinMatrices(ribbonBones().slice(0, 3)) }));

    // Six bones are asked for, three are bound: the three missing bones are zero matrices.
    expect(skinned!.skeleton.bones).toHaveLength(6);
    expect(vertexOf(skinned!, 31)).toEqual([0, 0, 0]);
    // The first row is all b0, so it holds.
    expect(vertexOf(skinned!, 0)[1]).toBeCloseTo(0.5, 5);
  });

  it('collapses the mesh of a skeleton with no bone to the origin, which Godot draws as nothing (edge case)', async () => {
    const [skinned] = skinnedMeshes(await render({ skinMatrices: [] }));

    expect(vertexOf(skinned!, 0)).toEqual([0, 0, 0]);
    expect(vertexOf(skinned!, 31)).toEqual([0, 0, 0]);
  });
});

/** The node the whole pipeline binds: the parse, the scene passes, then the registered component. */
function parsedMesh(content: string): {
  node: TscnNode;
  internalResources: TscnParserScene['internalResources'];
} {
  const scene = new TscnParser().parse(content);
  for (const { run } of nodeComponentRegistry.scenePasses()) run(scene.nodes, scene.internalResources);
  const [root] = scene.nodes;
  const node = root!.children.find((child) => child.name === 'Mesh');
  if (!node) throw new Error('expected a MeshInstance3D named Mesh below the root');
  return { node, internalResources: scene.internalResources };
}

type TscnParserScene = ReturnType<TscnParser['parse']>;

describe('MeshInstance3D with a skin set', () => {
  const content = (meshLines: string) => `[gd_scene format=3]
[sub_resource type="RibbonTrailMesh" id="Ribbon"]
[sub_resource type="Skin" id="Skin_1"]
[node name="Root" type="Node3D"]
[node name="Skeleton3D" type="Skeleton3D" parent="."]
bones/0/name = "b0"
bones/1/name = "b1"
bones/1/parent = 0
[node name="Mesh" type="MeshInstance3D" parent="."]
mesh = SubResource("Ribbon")
skeleton = NodePath("../Skeleton3D")
${meshLines}
`;

  async function renderParsed(meshLines: string) {
    const { node, internalResources } = parsedMesh(content(meshLines));
    return renderMeshInstance({ loader: loaderServing(), node, internalResources });
  }

  it('draws unskinned, as the Skin resource is not read here', async () => {
    const renderer = await renderParsed('skin = SubResource("Skin_1")');

    expect(skinnedMeshes(renderer)).toEqual([]);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws skinned once the skin is not set, which proves the fixture binds', async () => {
    expect(skinnedMeshes(await renderParsed(''))).toHaveLength(1);
  });
});
