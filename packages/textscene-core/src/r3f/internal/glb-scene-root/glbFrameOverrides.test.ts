/**
 * An instancing scene's override of a Skeleton3D or BoneAttachment3D, which three has no object for.
 * The importer's rig is Armature > Skeleton3D > [Body, Hip (a BoneAttachment3D) > Sword].
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import * as logger from '../../../logger';
import { createGLBMesh } from '../../../resources/formats/glb/glbProcessing';
import { NO_SIDECAR } from '../../../resources/formats/glb/testing/noSidecar';
import { RIG_GLB } from '../../../resources/formats/glb/testing/rigGlb';
import type { TscnNode } from '../../../parser/types';
import { flattenGlbObjects } from './glbHierarchy';
import { applyGlbNodeOverrides } from './glbNodeOverrides';

const SKELETON = 'Armature/Skeleton3D';
const ATTACHMENT = 'Armature/Skeleton3D/Hip';

const frameOverride = (path: string, extra: Partial<TscnNode>): TscnNode => {
  const at = path.lastIndexOf('/');
  return {
    rawProperties: {},
    type: '',
    name: path.slice(at + 1),
    instanceSubPath: path.slice(0, at),
    properties: {},
    children: [],
    overridesExistingNode: true,
    ...extra,
  };
};

const moveBy = (x: number, y: number, z: number) => ({
  transform: {
    basis_x: { x: 1, y: 0, z: 0 },
    basis_y: { x: 0, y: 1, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x, y, z },
  },
});

async function loadRig() {
  const root = await createGLBMesh(RIG_GLB, NO_SIDECAR);
  const named = (name: string) => root.getObjectByName(name)!;
  return {
    root,
    entries: flattenGlbObjects(root),
    hip: named('Hip'),
    sword: named('Sword'),
    body: named('Body'),
  };
}

/** Whether three draws `object`: no object from it to the root is hidden. */
function isDrawn(object: THREE.Object3D): boolean {
  for (let node: THREE.Object3D | null = object; node; node = node.parent) if (!node.visible) return false;
  return true;
}

afterEach(() => vi.restoreAllMocks());

describe('applyGlbNodeOverrides on a Skeleton3D', () => {
  it('hides the bones’ content and the skinned mesh with visible = false', async () => {
    const { root, entries, sword, body } = await loadRig();

    applyGlbNodeOverrides(root, [frameOverride(SKELETON, { rawProperties: { visible: 'false' } })], entries);

    expect([isDrawn(sword), isDrawn(body)]).toEqual([false, false]);
  });

  it('leaves the node above it drawn', async () => {
    const { root, entries } = await loadRig();

    applyGlbNodeOverrides(root, [frameOverride(SKELETON, { rawProperties: { visible: 'false' } })], entries);

    expect(isDrawn(root.getObjectByName('Armature')!)).toBe(true);
  });

  it('moves the bones with its transform', async () => {
    const { root, entries, hip } = await loadRig();

    const applied = applyGlbNodeOverrides(
      root,
      [frameOverride(SKELETON, { properties: moveBy(0, 2, 0) })],
      entries
    );
    root.updateMatrixWorld(true);

    expect(hip.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([0, 2, 0]);
    expect(applied.has('Skeleton3D')).toBe(true);
  });

  it('warns once for a bone property it does not drive yet, and names the issue', async () => {
    const { root, entries } = await loadRig();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const overrides = [frameOverride(SKELETON, { rawProperties: { show_rest_only: 'true' } })];

    applyGlbNodeOverrides(root, overrides, entries);
    applyGlbNodeOverrides(root, overrides, entries);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('show_rest_only');
    expect(warn.mock.calls[0]![0]).toContain('#980');
  });

  it('stays quiet for a property that changes no drawing', async () => {
    const { root, entries } = await loadRig();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    applyGlbNodeOverrides(
      root,
      [frameOverride(SKELETON, { rawProperties: { animate_physical_bones: 'false' } })],
      entries
    );

    expect(warn).not.toHaveBeenCalled();
  });
});

describe('applyGlbNodeOverrides on a BoneAttachment3D', () => {
  it('hides what hangs on the bone and nothing else with visible = false', async () => {
    const { root, entries, sword, body } = await loadRig();

    applyGlbNodeOverrides(
      root,
      [frameOverride(ATTACHMENT, { rawProperties: { visible: 'false' } })],
      entries
    );

    expect([isDrawn(sword), isDrawn(body)]).toEqual([false, true]);
  });

  it('warns that its transform is replaced by the bone’s pose, and moves nothing', async () => {
    const { root, entries, sword } = await loadRig();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    applyGlbNodeOverrides(root, [frameOverride(ATTACHMENT, { properties: moveBy(0, 2, 0) })], entries);
    root.updateMatrixWorld(true);

    expect(sword.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([0, 0, 0]);
    expect(warn.mock.calls[0]![0]).toContain('bone_attachment_3d.cpp:311');
  });

  it('warns for bone_name and names the issue', async () => {
    const { root, entries } = await loadRig();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    applyGlbNodeOverrides(
      root,
      [frameOverride(ATTACHMENT, { rawProperties: { bone_name: '"Hand"' } })],
      entries
    );

    expect(warn.mock.calls[0]![0]).toContain('#980');
  });
});

describe('applyGlbNodeOverrides on a path no node or frame has', () => {
  it('still warns that it matches nothing', async () => {
    const { root, entries } = await loadRig();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    applyGlbNodeOverrides(
      root,
      [frameOverride('Armature/Skeleton3D/Ghost', { rawProperties: { visible: 'false' } })],
      entries
    );

    expect(warn.mock.calls[0]![0]).toContain('matches nothing');
  });

  it('stays quiet about a Skeleton3D, which is a node of the imported scene', async () => {
    const { root, entries } = await loadRig();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

    applyGlbNodeOverrides(root, [frameOverride(SKELETON, { rawProperties: { visible: 'true' } })], entries);

    expect(warn).not.toHaveBeenCalled();
  });
});
