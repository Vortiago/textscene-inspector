/**
 * A MeshInstance3D bound to a Skeleton3D draws a surface with bone arrays skinned: each vertex is
 * the weighted sum of its bones' skin matrices, in mesh space, and the node's own transform applies
 * after (`skeleton.glsl:248-291`). A surface without bone arrays stays unskinned even when bound
 * (`mesh_storage.cpp:1213`).
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { parseTscnContent } from '../../../r3f/hooks/useParsedScene';
import type { SceneGraph } from '../../../core/SceneGraph';
import { DispatchedScene } from '../../../r3f/testing/DispatchedScene';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { loaderServing } from '../../../resources/testing/servingResourceLoader';
import { transform3DToMatrix } from '../../../r3f/nodeTreeTransforms';
import { instanceAs } from '../testing/reactThreeTestInstance';
import { RIBBON_BONE_Y, ribbonBonesText, ribbonScene } from '../testing/skinnedRibbon.testkit';
import type { Bone } from '../skeleton3d/skeletonPose';
import { automaticSkinMatrices } from '../skeleton3d/skeletonPose';
import '../../../r3f/nodes/index';

/** The six chained bones of `unit-mesh-instance-3d-skinned-ribbon.tscn`: b2 turned 60 degrees about Z. */
function ribbonBones(): Bone[] {
  return RIBBON_BONE_Y.map((y, i) => ({
    name: `b${i}`,
    parent: i - 1,
    rest: translation(y),
    enabled: true,
    position: { x: 0, y, z: 0 },
    rotation: i === TURNED_BONE ? { x: 0, y: 0, z: 0.5, w: 0.866025 } : { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 },
  }));
}

const TURNED_BONE = 2;

function translation(y: number) {
  return {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x: 0, y, z: 0 },
  };
}

function parsed(content: string): SceneGraph {
  const { sceneGraph, error } = parseTscnContent(content, 'res://main.tscn');
  if (!sceneGraph) throw new Error(`expected a scene, got ${error}`);
  return sceneGraph;
}

async function renderContent(content: string, files: Record<string, string> = {}) {
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene sceneGraph={parsed(content)} loader={loaderServing(files)} />
  );
  await settleLoads();
  return renderer;
}

const render = (scene?: Parameters<typeof ribbonScene>[0]) => renderContent(ribbonScene(scene));

function skinnedMeshes(renderer: Awaited<ReturnType<typeof render>>): THREE.SkinnedMesh[] {
  return renderer.scene.findAllByType('SkinnedMesh').map((m) => instanceAs<THREE.SkinnedMesh>(m));
}

function vertexOf(mesh: THREE.SkinnedMesh, index: number): number[] {
  return mesh.getVertexPosition(index, new THREE.Vector3()).toArray();
}

describe('MeshInstance3D bound to a Skeleton3D', () => {
  it('draws a surface with bone arrays as a SkinnedMesh over the skeleton the pass gave it', async () => {
    const renderer = await render();

    const [skinned] = skinnedMeshes(renderer);
    expect(skinned!.skeleton.bones).toHaveLength(6);
    expect(renderer.scene.findAllByType('Mesh')).toEqual([]);
  });

  it('leaves the bone matrices as filled once, so the renderer does not skin them again each frame', async () => {
    const [skinned] = skinnedMeshes(await render());
    const filled = Array.from(skinned!.skeleton.boneMatrices!);

    skinned!.skeleton.bones[2]!.matrixWorld.makeTranslation(9, 9, 9);
    skinned!.skeleton.update();

    expect(Array.from(skinned!.skeleton.boneMatrices!)).toEqual(filled);
    expect(filled[16 * 2 + 12]).not.toBe(9);
  });

  it('keeps the skeleton when a re-parse hands over the same matrices in a new array', async () => {
    const loader = loaderServing();
    const renderer = await ReactThreeTestRenderer.create(
      <DispatchedScene sceneGraph={parsed(ribbonScene())} loader={loader} />
    );
    const [before] = skinnedMeshes(renderer);

    await renderer.update(<DispatchedScene sceneGraph={parsed(ribbonScene())} loader={loader} />);
    const [after] = skinnedMeshes(renderer);

    expect(after!.skeleton).toBe(before!.skeleton);
  });

  it('moves each vertex by the matrices of its bones, in mesh space', async () => {
    const [skinned] = skinnedMeshes(await render());

    // Row 0 is all b0, which sits at its rest.
    expect(vertexOf(skinned!, 0)).toEqual([-0.2, 0.5, 0].map((v) => expect.closeTo(v, 5)));
    // The last row is all b5, which turns with b2 about (0, 0.1, 0): (0.2, -0.5) swings to
    // (0.6196, -0.0268), a worked rotation of 60 degrees.
    expect(vertexOf(skinned!, 31)).toEqual([0.6196, -0.0268, 0].map((v) => expect.closeTo(v, 3)));
  });

  it('blends the vertices of a row between the two bones its weights name', async () => {
    const [skinned] = skinnedMeshes(await render());

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
      meshLines:
        'skeleton = NodePath("../Skeleton3D")\ntransform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 0, 0)',
    });
    const [skinned] = skinnedMeshes(renderer);

    skinned!.updateMatrixWorld(true);
    expect(skinned!.position.x).toBeCloseTo(3, 6);
    // Detached from the skeleton, so the skin matrices stay in mesh space.
    expect(skinned!.bindMode).toBe(THREE.DetachedBindMode);
    expect(vertexOf(skinned!, 0)[0]).toBeCloseTo(-0.2, 5);
  });

  it('feeds the skin matrices to the skeleton one for each bone', async () => {
    const matrices = automaticSkinMatrices(ribbonBones(), false);
    const [skinned] = skinnedMeshes(await render());

    skinned!.skeleton.update();
    const bone2 = new THREE.Matrix4().fromArray(skinned!.skeleton.boneMatrices!, 2 * 16);
    expect(bone2.toArray()).toEqual(
      transform3DToMatrix(matrices[2]!)
        .toArray()
        .map((v) => expect.closeTo(v, 5))
    );
  });

  it('draws a surface with no bone arrays unskinned although the node is bound', async () => {
    const renderer = await render({ mesh: 'Box' });

    expect(skinnedMeshes(renderer)).toEqual([]);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws a node that binds no skeleton unskinned, at its rest pose', async () => {
    const renderer = await render({ meshLines: '' });

    expect(skinnedMeshes(renderer)).toEqual([]);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws the material overlay skinned too, over the same skeleton', async () => {
    const renderer = await render({
      meshLines: 'skeleton = NodePath("../Skeleton3D")\nmaterial_overlay = SubResource("Overlay")',
    });

    const [base, overlay] = skinnedMeshes(renderer);
    expect(overlay).toBeDefined();
    expect(overlay!.skeleton).toBe(base!.skeleton);
    expect(overlay!.bindMode).toBe(THREE.DetachedBindMode);
  });

  it('keeps the surface material on the skinned mesh', async () => {
    const [skinned] = skinnedMeshes(await render());

    const material = (
      Array.isArray(skinned!.material) ? skinned!.material[0] : skinned!.material
    ) as THREE.MeshStandardMaterial;
    expect(material.color.r).toBeGreaterThan(0.9);
    expect(material.color.g).toBeLessThan(0.1);
  });

  it('lets a bone past the skin collapse its vertices, as an empty bone buffer does (edge case)', async () => {
    const [skinned] = skinnedMeshes(await render({ bones: ribbonBonesText(3) }));

    // Six bones are asked for, three are bound: the three missing bones are zero matrices.
    expect(skinned!.skeleton.bones).toHaveLength(6);
    expect(vertexOf(skinned!, 31)).toEqual([0, 0, 0]);
    // The first row is all b0, so it holds.
    expect(vertexOf(skinned!, 0)[1]).toBeCloseTo(0.5, 5);
  });

  it('collapses the mesh of a skeleton with no bone to the origin, which Godot draws as nothing (edge case)', async () => {
    const [skinned] = skinnedMeshes(await render({ bones: '' }));

    expect(vertexOf(skinned!, 0)).toEqual([0, 0, 0]);
    expect(vertexOf(skinned!, 31)).toEqual([0, 0, 0]);
  });
});

describe('MeshInstance3D with a skin set', () => {
  it('draws unskinned, as the Skin resource is not read here', async () => {
    const renderer = await render({
      meshLines: 'skeleton = NodePath("../Skeleton3D")\nskin = SubResource("Skin_1")',
    });

    expect(skinnedMeshes(renderer)).toEqual([]);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });
});

const RIG_PATH = 'res://rig.tscn';

describe('MeshInstance3D bound to a Skeleton3D inside an instanced scene', () => {
  const host = `[gd_scene format=3]
[ext_resource type="PackedScene" path="${RIG_PATH}" id="1"]
[node name="Host" type="Node3D"]
[node name="Rig" parent="." instance=ExtResource("1")]
`;

  it('draws skinned once the loader brings the sub-scene, which the root parse never holds', async () => {
    // The sub-scene holds the ribbon and its skeleton, as `unit-mesh-instance-3d-skinned-ribbon.tscn` does.
    const renderer = await renderContent(host, { [RIG_PATH]: ribbonScene() });

    const [skinned] = skinnedMeshes(renderer);
    expect(vertexOf(skinned!, 31)).toEqual(vertexOf(skinnedMeshes(await render())[0]!, 31));
  });
});
