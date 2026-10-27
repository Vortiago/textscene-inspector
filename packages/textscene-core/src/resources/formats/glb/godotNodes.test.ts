import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { cloneWithMaterials, createGLBMesh } from './glbProcessing';
import { nodesGlb } from './testing/nodesGlb';
import { RIG_GLB } from './testing/rigGlb';
import {
  godotBoneRest,
  godotFrames,
  godotNodeName,
  godotNodePaths,
  godotSkeletonOfBone,
  isGlbObject,
  isGodotSceneRoot,
} from './godotNodes';
import { NO_SIDECAR } from './testing/noSidecar';

function byName(root: THREE.Object3D, name: string): THREE.Object3D {
  const object = root.getObjectByName(name);
  if (!object) throw new Error(`expected an object named ${name}, got none`);
  return object;
}

describe('godotNodeName', () => {
  it('gives the name Godot imports a node under, where three spells it otherwise', async () => {
    const root = await createGLBMesh(nodesGlb([{ name: 'Cube.001' }, { name: 'Cube.001' }]), NO_SIDECAR);
    expect(godotNodeName(byName(root, 'Cube001'))).toBe('Cube_001');
    expect(godotNodeName(byName(root, 'Cube001_1'))).toBe('Cube_0012');
  });

  it('keeps the name on a clone', async () => {
    const root = await createGLBMesh(nodesGlb([{ name: 'Lamp.001' }]), NO_SIDECAR);
    expect(godotNodeName(byName(cloneWithMaterials(root), 'Lamp001'))).toBe('Lamp_001');
  });

  it('gives none for a primitive of a Group, which is no node', async () => {
    const root = await createGLBMesh(nodesGlb([{ name: 'Multi', mesh: 1 }]), NO_SIDECAR);
    expect(byName(root, 'Multi').children.map(godotNodeName)).toEqual([undefined, undefined]);
  });

  it('gives a skin joint its bone name, which keeps a dot, as a validated node name', async () => {
    const root = await createGLBMesh(nodesGlb([{ name: 'Hip.L' }], { skins: [{ joints: [0] }] }), NO_SIDECAR);
    const hip = byName(root, 'HipL');
    expect(godotNodeName(hip)).toBe('Hip_L');
    expect(godotNodePaths(hip)).toEqual([]);
  });

  it('names the mesh under a joint after the joint, as Godot names its MeshInstance3D', async () => {
    const glb = nodesGlb([{ name: 'Hand', mesh: 0 }], { skins: [{ joints: [0] }] });
    const mesh = byName(await createGLBMesh(glb, NO_SIDECAR), 'Hand').children[0]!.children[0]!;
    expect(godotNodeName(mesh)).toBe('Hand');
    expect(godotNodePaths(mesh)).toEqual(['Skeleton3D/Hand/Hand']);
  });

  it('names the camera under a joint after the joint, as Godot names its Camera3D', async () => {
    const glb = nodesGlb([{ name: 'Head', camera: 0 }], {
      skins: [{ joints: [0] }],
      cameras: [{ type: 'perspective', perspective: { yfov: 1, znear: 0.1 } }],
    });
    const camera = byName(await createGLBMesh(glb, NO_SIDECAR), 'Head').children[0]!.children[0]!;
    expect(godotNodeName(camera)).toBe('Head');
    expect(godotNodePaths(camera)).toEqual(['Skeleton3D/Head/Head']);
  });

  it('gives a skinned mesh its place below the Skeleton3D, where Godot moves it', async () => {
    const glb = nodesGlb([{ name: 'Hip' }, { name: 'Body', mesh: 0, skin: 0 }], { skins: [{ joints: [0] }] });
    expect(godotNodePaths(byName(await createGLBMesh(glb, NO_SIDECAR), 'Body'))).toEqual(['Skeleton3D/Body']);
  });

  it('gives the Skeleton3D to the object above it, and the BoneAttachment3D to its bone, as stand-ins', async () => {
    const root = await createGLBMesh(RIG_GLB, NO_SIDECAR);
    expect(godotFrames(byName(root, 'Armature'))).toEqual([
      { path: 'Armature/Skeleton3D', kind: 'skeleton' },
    ]);
    expect(godotFrames(byName(root, 'Hip'))).toEqual([
      { path: 'Armature/Skeleton3D/Hip', kind: 'boneAttachment' },
    ]);
    expect(godotNodePaths(byName(root, 'Hip'))).toEqual([]);
  });

  it('tells a bone the Skeleton3D it belongs to', async () => {
    const root = await createGLBMesh(RIG_GLB, NO_SIDECAR);
    expect(godotSkeletonOfBone(byName(root, 'Hip'))).toBe('Armature/Skeleton3D');
    expect(godotSkeletonOfBone(byName(root, 'Armature'))).toBeUndefined();
  });

  it('gives a node its path and the scene root its mark', async () => {
    const glb = nodesGlb([
      { name: 'A', children: [1] },
      { name: 'B', mesh: 0 },
    ]);
    const root = await createGLBMesh(glb, NO_SIDECAR);
    expect(godotNodePaths(byName(root, 'B'))).toEqual(['A/B']);
    expect([isGodotSceneRoot(root), isGodotSceneRoot(byName(root, 'B'))]).toEqual([true, false]);
  });

  it('gives a primitive of a Group no path, and marks it a part of the glTF', async () => {
    const root = await createGLBMesh(nodesGlb([{ name: 'Multi', mesh: 1 }]), NO_SIDECAR);
    const primitive = byName(root, 'Multi').children[0]!;
    expect(godotNodePaths(primitive)).toEqual([]);
    expect(isGlbObject(primitive)).toBe(true);
  });

  it('marks no object of a scene that mounts the glTF', () => {
    expect(isGlbObject(new THREE.Object3D())).toBe(false);
  });
});

describe('godotBoneRest', () => {
  const SWORD_GLB = nodesGlb(
    [
      { name: 'Hip', children: [1] },
      { name: 'Sword', mesh: 0, translation: [1.5, 0.5, 0] },
    ],
    { skins: [{ joints: [0] }] }
  );
  const GODOT_44 = { ...NO_SIDECAR, naming: { ...NO_SIDECAR.naming, namingVersion: 1 } };

  it('keeps the glTF transform of a node Godot makes a bone, which the bone holds as its rest pose', async () => {
    const sword = byName(await createGLBMesh(SWORD_GLB, GODOT_44), 'Sword');
    expect(godotBoneRest(sword)?.elements.slice(12, 15)).toEqual([1.5, 0.5, 0]);
  });

  it('keeps it on a clone', async () => {
    const root = await createGLBMesh(SWORD_GLB, GODOT_44);
    expect(godotBoneRest(byName(cloneWithMaterials(root), 'Sword'))).toBeDefined();
  });

  it('gives none for a node that Godot keeps as a node, whose transform is its own', async () => {
    const sword = byName(await createGLBMesh(SWORD_GLB, NO_SIDECAR), 'Sword');
    expect(godotBoneRest(sword)).toBeUndefined();
  });
});
