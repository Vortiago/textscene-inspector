import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildStackScene } from './buildStackScene';
import { DRAWN_POSE_SOURCE } from './drawnPoseSource';
import type { StackTarget } from './skeletonPose';
import type { Skeleton2DRig } from './skeletonRig';

const REACH = { length: 10, angle: 0 };

function below(parent: THREE.Object3D, x: number): THREE.Object3D {
  const object = new THREE.Group();
  object.position.x = x;
  object.updateMatrix();
  parent.add(object);
  return object;
}

function outsideBoneAt(path: string, parentPath: string): StackTarget {
  return {
    path,
    isNode2D: true,
    boneIndex: -1,
    indexInSkeleton: -1,
    carrier: 0,
    outsideBone: { parentPath, reach: REACH },
  };
}

describe('buildStackScene over drawn objects', () => {
  // Bone/Holder/X/Y: X and Y join no skeleton, and both sit below the bone of the skeleton.
  it('places an outside bone below the outside bone above it, not below the bone that carries both', () => {
    const skeleton = new THREE.Group();
    const bone = below(skeleton, 5);
    const holder = below(bone, 1);
    const x = below(holder, 2);
    const y = below(x, 3);
    const rig = { bones: [{ path: 'Bone', parent: -1, reach: REACH }] } as unknown as Skeleton2DRig;
    const targets = new Map([
      ['X', outsideBoneAt('Bone/Holder/X', 'Bone/Holder')],
      ['Y', outsideBoneAt('Bone/Holder/X/Y', 'Bone/Holder/X')],
    ]);
    const anchorOf = new Map([
      ['Bone/Holder', holder],
      ['Bone/Holder/X', x],
      ['Bone/Holder/X/Y', y],
    ]);

    const { scene, posed } = buildStackScene(
      targets,
      rig,
      [skeleton, bone],
      (path) => anchorOf.get(path),
      DRAWN_POSE_SOURCE
    );

    const outsideX = scene.nodes.get('X')!.outsideBone!;
    expect(scene.nodes.get('Y')!.outsideBone!.parent.outsideBone).toBe(outsideX);
    expect(outsideX.parent).toMatchObject({ carrier: 0, offset: { tx: 1 } });
    expect(posed.map(({ parent }) => parent)).toEqual([-1, -1, 1]);
  });
});
