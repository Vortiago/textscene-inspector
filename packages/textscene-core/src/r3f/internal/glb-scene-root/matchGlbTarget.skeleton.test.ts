/**
 * Godot paths into a skinned glTF, as Godot 4.6.3 imports it: a bone is no node, a node under a bone
 * sits in a BoneAttachment3D of the bone's name, and a bone with a mesh holds it in a
 * BoneAttachment3D of its own name.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { createGLBMesh, initGlbModules } from '../../../resources/formats/glb/glbProcessing';
import { nodesGlb } from '../../../resources/formats/glb/testing/nodesGlb';
import { NO_SIDECAR } from '../../../resources/formats/glb/testing/noSidecar';
import { godotNodeName } from '../../../resources/formats/glb/nodeNames';
import { flattenGlbObjects } from './glbHierarchy';
import { matchGlbTarget } from './matchGlbTarget';

const GODOT_4_4 = { naming: { ...NO_SIDECAR.naming, namingVersion: 1 } };

/** The joint Hand holds the mesh Sword. */
const SWORD = nodesGlb(
  [
    { name: 'Hand', children: [1] },
    { name: 'Sword', mesh: 0 },
  ],
  { skins: [{ joints: [0] }] }
);

async function match(
  glb: ArrayBuffer,
  godotPath: string,
  options = NO_SIDECAR
): Promise<THREE.Object3D | undefined> {
  const root = await createGLBMesh(glb, options);
  return matchGlbTarget(flattenGlbObjects(root), godotPath, { allowAncestor: false })?.object;
}

beforeAll(async () => {
  await initGlbModules();
});

describe('matchGlbTarget in a skeleton', () => {
  it('finds a node in the BoneAttachment3D of the bone above it', async () => {
    const sword = await match(SWORD, 'Skeleton3D/Hand/Sword');
    expect(sword && godotNodeName(sword)).toBe('Sword');
  });

  it('finds the mesh of a node Godot makes a bone before 4.5 in a BoneAttachment3D of its name', async () => {
    const sword = await match(SWORD, 'Skeleton3D/Sword/Sword', GODOT_4_4);
    expect(sword?.type).toBe('Mesh');
  });

  it('finds the mesh of a joint in a BoneAttachment3D of the joint’s name', async () => {
    const glb = nodesGlb(
      [
        { name: 'Arm', children: [1] },
        { name: 'Hand', mesh: 0 },
      ],
      { skins: [{ joints: [0, 1] }] }
    );
    const hand = await match(glb, 'Skeleton3D/Hand/Hand');
    expect(hand?.type).toBe('Mesh');
    expect(hand?.parent?.type).toBe('Bone');
  });

  it('skips the bones between a node and the skeleton’s parent', async () => {
    const glb = nodesGlb(
      [
        { name: 'Root', children: [1] },
        { name: 'Arm', children: [2] },
        { name: 'Hand', children: [3] },
        { name: 'Sword', mesh: 0, children: [4] },
        { name: 'Gem', mesh: 0 },
      ],
      { skins: [{ joints: [1, 2] }] }
    );
    expect((await match(glb, 'Root/Skeleton3D/Hand/Sword/Gem'))?.name).toBe('Gem');
    expect((await match(glb, 'Root/Skeleton3D/Gem/Gem', GODOT_4_4))?.name).toBe('Gem');
  });

  it('finds a skinned mesh straight under the Skeleton3D', async () => {
    const glb = nodesGlb(
      [
        { name: 'Arm', children: [1] },
        { name: 'Body', mesh: 0, skin: 0 },
      ],
      {
        skins: [{ joints: [0] }],
      }
    );
    const options = { naming: { ...NO_SIDECAR.naming, importAsSkeletonBones: true } };
    expect((await match(glb, 'Skeleton3D/Body', options))?.name).toBe('Body');
  });

  it('finds the bone for its BoneAttachment3D, which follows it', async () => {
    expect((await match(SWORD, 'Skeleton3D/Hand'))?.type).toBe('Bone');
  });
});
