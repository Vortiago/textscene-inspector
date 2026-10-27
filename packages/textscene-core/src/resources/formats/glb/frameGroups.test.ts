/**
 * The objects of the Skeleton3D and BoneAttachment3D nodes Godot's importer adds to a rig: a group
 * below the object each follows, which holds what Godot puts below the node.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { flattenGlbObjects } from '../../../r3f/internal/glb-scene-root/glbHierarchy';
import { cloneWithMaterials, createGLBMesh } from './glbProcessing';
import { frameGroupPath } from './godotNodes';
import { NO_SIDECAR } from './testing/noSidecar';
import { RIG_GLB } from './testing/rigGlb';

const loadRig = () => createGLBMesh(RIG_GLB, NO_SIDECAR);

function byName(root: THREE.Object3D, name: string): THREE.Object3D {
  const object = root.getObjectByName(name);
  if (!object) throw new Error(`expected an object named ${name}, got none`);
  return object;
}

describe('groupFrames', () => {
  it('holds the root bones in a group of the Skeleton3D, in the place of the first bone', async () => {
    const armature = byName(await loadRig(), 'Armature');

    expect(armature.children.map(frameGroupPath)).toEqual(['Armature/Skeleton3D', undefined]);
    expect(armature.children[0]!.children).toEqual([byName(armature, 'Hip')]);
  });

  it('holds what hangs on a bone in a group of its BoneAttachment3D', async () => {
    const hip = byName(await loadRig(), 'Hip');

    expect(hip.children.map(frameGroupPath)).toEqual(['Armature/Skeleton3D/Hip']);
    expect(hip.children[0]!.children).toEqual([byName(hip, 'Sword')]);
  });

  it('leaves the skinned mesh where the glTF holds it', async () => {
    const root = await loadRig();

    expect(byName(root, 'Body').parent).toBe(byName(root, 'Armature'));
  });

  it('leaves every relative path of the walk what it was', async () => {
    const paths = flattenGlbObjects(await loadRig()).map(({ relPath }) => relPath);

    expect(paths).toEqual(['Armature', 'Armature/Hip', 'Armature/Hip/Sword', 'Armature/Body']);
  });

  it('keeps the groups on a clone', async () => {
    const armature = byName(cloneWithMaterials(await loadRig()), 'Armature');

    expect(armature.children.map(frameGroupPath)).toEqual(['Armature/Skeleton3D', undefined]);
  });
});
