/**
 * A Godot node path on a loaded GLB, as Godot 4.6.3's glTF importer places the nodes: a lookup by
 * the whole path. The importer adds a `Skeleton3D` and a `BoneAttachment3D` that no glTF node
 * stands for, and moves a skinned mesh under its Skeleton3D, so `player.glb`'s `Skeleton/Robot` is
 * `Skeleton/Skeleton3D/Robot` in a scene.
 */

import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import * as logger from '../../../logger';
import { createGLBMesh } from '../../../resources/formats/glb/glbProcessing';
import { RIG_GLB } from '../../../resources/formats/glb/testing/rigGlb';
import { nodesGlb } from '../../../resources/formats/glb/testing/nodesGlb';
import { NO_SIDECAR } from '../../../resources/formats/glb/testing/noSidecar';
import { flattenGlbObjects } from './glbHierarchy';
import { findGlbNode, findGlbTarget, matchGlbNode } from './glbPathLookup';

async function entriesOf(glb: ArrayBuffer, options = NO_SIDECAR) {
  return flattenGlbObjects(await createGLBMesh(glb, options));
}

async function targetOf(glb: ArrayBuffer, godotPath: string, options = NO_SIDECAR) {
  return findGlbTarget(await entriesOf(glb, options), godotPath)?.object;
}

const nameOf = (object: THREE.Object3D | undefined) => object?.name;

describe('findGlbTarget', () => {
  it('finds a node by its whole path', async () => {
    const glb = nodesGlb([
      { name: 'A', children: [1] },
      { name: 'B', mesh: 0 },
    ]);
    expect(nameOf(await targetOf(glb, 'A/B'))).toBe('B');
  });

  it('finds a skinned mesh below the Skeleton3D Godot moved it under', async () => {
    expect(nameOf(await targetOf(RIG_GLB, 'Armature/Skeleton3D/Body'))).toBe('Body');
  });

  it('names no skinned mesh at the place the glTF holds it, where Godot no longer has it', async () => {
    expect(await targetOf(RIG_GLB, 'Armature/Body')).toBeUndefined();
  });

  it('finds the node above a Skeleton3D for the Skeleton3D, which three has no object for', async () => {
    expect(nameOf(await targetOf(RIG_GLB, 'Armature/Skeleton3D'))).toBe('Armature');
  });

  it('finds the bone for the BoneAttachment3D that follows it', async () => {
    expect((await targetOf(RIG_GLB, 'Armature/Skeleton3D/Hip'))?.type).toBe('Bone');
  });

  it('finds a node below a bone in the BoneAttachment3D of that bone', async () => {
    expect(nameOf(await targetOf(RIG_GLB, 'Armature/Skeleton3D/Hip/Sword'))).toBe('Sword');
  });

  it('finds a node by the bone name before 4.5, which names its BoneAttachment3D after the node', async () => {
    const godot44 = { ...NO_SIDECAR, naming: { ...NO_SIDECAR.naming, namingVersion: 1 } };
    expect(nameOf(await targetOf(RIG_GLB, 'Armature/Skeleton3D/Sword/Sword', godot44))).toBe('Sword');
  });

  it('names nothing across a level the path leaves out', async () => {
    expect(await targetOf(RIG_GLB, 'Armature/Hip/Sword')).toBeUndefined();
  });

  it('does not match a same-named node on an unrelated branch', async () => {
    const glb = nodesGlb([
      { name: 'Weapons', children: [1] },
      { name: 'Body', mesh: 0 },
    ]);
    expect(await targetOf(glb, 'Character/Torso/Body')).toBeUndefined();
  });

  it('names nothing for a path that is a prefix of the nodes below it', async () => {
    const glb = nodesGlb([{ name: 'A', children: [1] }, { name: 'B' }]);
    expect(await targetOf(glb, 'A/B/C')).toBeUndefined();
  });
});

describe('findGlbNode', () => {
  it('finds the object a node is', async () => {
    expect(nameOf(findGlbNode(await entriesOf(RIG_GLB), 'Armature/Skeleton3D/Hip/Sword')?.object)).toBe(
      'Sword'
    );
  });

  it('finds none for a Skeleton3D, which no object is', async () => {
    expect(findGlbNode(await entriesOf(RIG_GLB), 'Armature/Skeleton3D')).toBeNull();
  });

  it('finds none for a BoneAttachment3D, which the bone only stands in for', async () => {
    expect(findGlbNode(await entriesOf(RIG_GLB), 'Armature/Skeleton3D/Hip')).toBeNull();
  });
});

describe('matchGlbNode', () => {
  it('returns null and warns once for a node the object only stands in for', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    expect(matchGlbNode(await entriesOf(RIG_GLB), 'Armature/Skeleton3D')).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Armature/Skeleton3D'));
    warn.mockRestore();
  });

  it('warns once for a path asked again', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const entries = await entriesOf(RIG_GLB);

    matchGlbNode(entries, 'NoSuch/Thing');
    matchGlbNode(entries, 'NoSuch/Thing');

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('returns the entry findGlbNode finds, with no log', async () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const entries = await entriesOf(RIG_GLB);

    expect(matchGlbNode(entries, 'Armature/Skeleton3D/Body')).toBe(
      findGlbNode(entries, 'Armature/Skeleton3D/Body')
    );
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
