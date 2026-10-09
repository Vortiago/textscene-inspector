import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createGLBMesh, initGlbModules } from './glbProcessing';
import { nodesGlb } from './testing/nodesGlb';
import { isMeshInstance, meshInstanceSurfaces } from './meshInstances';
import { NO_SIDECAR } from './testing/noSidecar';

function byName(root: THREE.Object3D, name: string): THREE.Object3D {
  const object = root.getObjectByName(name);
  if (!object) throw new Error(`expected an object named ${name}, got none`);
  return object;
}

beforeAll(async () => {
  await initGlbModules();
});

describe('isMeshInstance', () => {
  it('marks a node with a one-primitive mesh, which is the Mesh itself', async () => {
    const root = await createGLBMesh(nodesGlb([{ name: 'Single', mesh: 0 }]), NO_SIDECAR);

    expect(isMeshInstance(byName(root, 'Single'))).toBe(true);
  });

  it('marks the Group of a node with several primitives, and not its primitives', async () => {
    const root = await createGLBMesh(nodesGlb([{ name: 'Multi', mesh: 1 }]), NO_SIDECAR);
    const group = byName(root, 'Multi');

    expect(isMeshInstance(group)).toBe(true);
    expect(group.children.map(isMeshInstance)).toEqual([false, false]);
  });

  it('marks the mesh of a node that also holds a camera, under the node Group', async () => {
    const root = await createGLBMesh(
      nodesGlb([{ name: 'Viewer', mesh: 0, camera: 0 }], {
        cameras: [{ type: 'perspective', perspective: { yfov: 1, znear: 0.1 } }],
      }),
      NO_SIDECAR
    );
    const node = byName(root, 'Viewer');

    expect(isMeshInstance(node)).toBe(false);
    expect(node.children.filter(isMeshInstance)).toHaveLength(1);
  });

  it('marks a child node under a Group of primitives', async () => {
    const root = await createGLBMesh(
      nodesGlb([
        { name: 'Multi', mesh: 1, children: [1] },
        { name: 'Child', mesh: 0 },
      ]),
      NO_SIDECAR
    );

    expect(isMeshInstance(byName(root, 'Child'))).toBe(true);
  });

  it('marks no node without a mesh', async () => {
    const root = await createGLBMesh(nodesGlb([{ name: 'Empty' }]), NO_SIDECAR);

    expect(isMeshInstance(byName(root, 'Empty'))).toBe(false);
  });
});

describe('meshInstanceSurfaces', () => {
  it('gives a one-primitive mesh as its own surface', async () => {
    const root = await createGLBMesh(nodesGlb([{ name: 'Single', mesh: 0 }]), NO_SIDECAR);
    const single = byName(root, 'Single');

    expect(meshInstanceSurfaces(single)).toEqual([single]);
  });

  it('gives the primitives of a Group, and not a child node', async () => {
    const root = await createGLBMesh(
      nodesGlb([
        { name: 'Multi', mesh: 1, children: [1] },
        { name: 'Child', mesh: 0 },
      ]),
      NO_SIDECAR
    );
    const group = byName(root, 'Multi');

    expect(meshInstanceSurfaces(group)).toEqual(group.children.filter((c) => c.name !== 'Child'));
    expect(meshInstanceSurfaces(group)).toHaveLength(2);
  });

  it('gives no surface for an object Godot does not import as a MeshInstance3D', () => {
    expect(meshInstanceSurfaces(new THREE.Group())).toEqual([]);
  });
});
