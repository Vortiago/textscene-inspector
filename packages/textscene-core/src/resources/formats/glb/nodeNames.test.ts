import { beforeAll, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { cloneWithMaterials, createGLBMesh, initGlbModules } from './glbProcessing';
import { nodesGlb } from './testing/nodesGlb';
import { godotNodeName } from './nodeNames';
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

  it('gives none for a skin joint, which Godot makes a bone', async () => {
    const root = await createGLBMesh(nodesGlb([{ name: 'Hip' }], { skins: [{ joints: [0] }] }), NO_SIDECAR);
    expect(godotNodeName(byName(root, 'Hip'))).toBeUndefined();
  });
});
