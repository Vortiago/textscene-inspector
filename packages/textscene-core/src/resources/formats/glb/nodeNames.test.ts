import { beforeAll, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { cloneWithMaterials, createGLBMesh, initGlbModules } from './glbProcessing';
import { nodesGlb } from './testing/nodesGlb';
import { godotNodeName, godotNodeRole } from './nodeNames';
import { NO_SIDECAR } from './testing/noSidecar';

function byName(root: THREE.Object3D, name: string): THREE.Object3D {
  const object = root.getObjectByName(name);
  if (!object) throw new Error(`expected an object named ${name}, got none`);
  return object;
}

beforeAll(async () => {
  await initGlbModules();
});

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
    expect(godotNodeRole(hip)).toBe('bone');
  });

  it('names the mesh under a joint after the joint, as Godot names its MeshInstance3D', async () => {
    const glb = nodesGlb([{ name: 'Hand', mesh: 0 }], { skins: [{ joints: [0] }] });
    const mesh = byName(await createGLBMesh(glb, NO_SIDECAR), 'Hand').children[0]!;
    expect(godotNodeName(mesh)).toBe('Hand');
    expect(godotNodeRole(mesh)).toBe('node');
  });

  it('names the camera under a joint after the joint, as Godot names its Camera3D', async () => {
    const glb = nodesGlb([{ name: 'Head', camera: 0 }], {
      skins: [{ joints: [0] }],
      cameras: [{ type: 'perspective', perspective: { yfov: 1, znear: 0.1 } }],
    });
    const camera = byName(await createGLBMesh(glb, NO_SIDECAR), 'Head').children[0]!;
    expect(godotNodeName(camera)).toBe('Head');
    expect(godotNodeRole(camera)).toBe('node');
  });

  it('marks a skinned mesh, which Godot puts straight under its Skeleton3D', async () => {
    const glb = nodesGlb([{ name: 'Hip' }, { name: 'Body', mesh: 0, skin: 0 }], { skins: [{ joints: [0] }] });
    expect(godotNodeRole(byName(await createGLBMesh(glb, NO_SIDECAR), 'Body'))).toBe('skinnedMesh');
  });

  it('gives any other object no name and the node role', async () => {
    const root = await createGLBMesh(nodesGlb([{ name: 'Multi', mesh: 1 }]), NO_SIDECAR);
    const primitive = byName(root, 'Multi').children[0]!;
    expect(godotNodeRole(primitive)).toBe('node');
  });
});
