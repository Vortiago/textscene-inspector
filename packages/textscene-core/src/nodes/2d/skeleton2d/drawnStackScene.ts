/**
 * The scene a modification stack solves in, read from the drawn Skeleton2D, its drawn bones and the
 * drawn nodes the stack names. Each transform is the `real_t` value the scene file stores.
 */

import type * as THREE from 'three';
import {
  affineInverseTransform2D,
  multiplyTransform2D,
  mutableTransform2D,
  TRANSFORM2D_IDENTITY,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import { storedTransform2D } from '../../../godot/math/real.js';
import { canvasTransformInto, transform2DWithin } from '../../../r3f/node2dTransform.js';
import {
  outsideBonesOf,
  type OutsideBone,
  type StackNode,
  type StackPlacement,
  type StackScene,
} from './modificationStack/stackScene.js';
import type { StackTarget } from './skeletonPose.js';
import type { Skeleton2DRig } from './skeletonRig.js';

/** A bone a solve poses: its drawn object, the local transform it is drawn with and its parent in the list, or -1. */
export interface PosedBone {
  object: THREE.Object3D;
  from: Transform2DColumns;
  parent: number;
}

export interface DrawnStackScene {
  scene: StackScene;
  /** The bones of the skeleton by index, then each outside bone in the order `outsideBonesOf` gives. */
  posed: PosedBone[];
}

/**
 * The scene of a stack whose targets are `targets`. `bodies` holds the skeleton, then its bones, and
 * `anchorOf` the drawn node at each live path the stack reads that is no bone of the skeleton.
 */
export function drawnStackScene(
  targets: ReadonlyMap<string, StackTarget>,
  rig: Skeleton2DRig,
  bodies: readonly THREE.Object3D[],
  anchorOf: ReadonlyMap<string, THREE.Object3D>
): DrawnStackScene {
  const drawn = new DrawnNodes(targets.values(), bodies, anchorOf);
  const nodes = new Map<string, StackNode>();
  for (const [literal, target] of targets) nodes.set(literal, drawn.node(target));
  const scene: StackScene = {
    skeletonGlobal: canvasTransformOf(bodies[0]!),
    bones: rig.bones.map(({ parent, reach }) => ({ parent, length: reach.length, boneAngle: reach.angle })),
    nodes,
  };
  const outside = outsideBonesOf(scene);
  const posed = [
    ...rig.bones.map(({ parent }, index) => ({
      object: bodies[index + 1]!,
      from: transformWithin(bodies[index + 1]!, bodies[parent + 1]!),
      parent,
    })),
    ...outside.map((bone) => ({
      object: drawn.objectOf(bone),
      from: bone.local,
      parent: bone.parent.outsideBone ? rig.bones.length + outside.indexOf(bone.parent.outsideBone) : -1,
    })),
  ];
  return { scene, posed };
}

/** The drawn nodes a stack names, each read once as the node the solve sees. */
class DrawnNodes {
  /** The target of each drawn Bone2D that is no bone of the skeleton. */
  private readonly outsideAt = new Map<THREE.Object3D, StackTarget>();
  private readonly outsideBones = new Map<StackTarget, OutsideBone>();
  private readonly objects = new Map<OutsideBone, THREE.Object3D>();

  constructor(
    targets: Iterable<StackTarget>,
    private readonly bodies: readonly THREE.Object3D[],
    private readonly anchorOf: ReadonlyMap<string, THREE.Object3D>
  ) {
    for (const target of targets) {
      if (target.outsideBone) this.outsideAt.set(anchorOf.get(target.path)!, target);
    }
  }

  node(target: StackTarget): StackNode {
    const { path, isNode2D, boneIndex, indexInSkeleton, carrier } = target;
    if (target.outsideBone) {
      return { boneIndex, indexInSkeleton, placement: null, outsideBone: this.outsideBone(target) };
    }
    let placement: StackPlacement | null = null;
    if (boneIndex >= 0) placement = { carrier: boneIndex, offset: TRANSFORM2D_IDENTITY };
    else if (isNode2D) placement = this.placement(this.anchorOf.get(path), carrier);
    return { boneIndex, indexInSkeleton, placement, outsideBone: null };
  }

  objectOf(bone: OutsideBone): THREE.Object3D {
    return this.objects.get(bone)!;
  }

  private outsideBone(target: StackTarget): OutsideBone {
    const made = this.outsideBones.get(target);
    if (made) return made;
    const { parentPath, reach } = target.outsideBone!;
    const object = this.anchorOf.get(target.path)!;
    const above = parentPath === null ? undefined : this.anchorOf.get(parentPath);
    const bone: OutsideBone = {
      parent: this.placement(above, target.carrier),
      local: above ? transformWithin(object, above) : canvasTransformOf(object),
      length: reach.length,
      boneAngle: reach.angle,
    };
    this.outsideBones.set(target, bone);
    this.objects.set(bone, object);
    return bone;
  }

  /**
   * Where the drawn node `object` sits: below the nearest of the bone `carrier` and an outside bone
   * at or above it, else on the canvas. No object is the canvas itself.
   */
  private placement(object: THREE.Object3D | undefined, carrier: number): StackPlacement {
    if (!object) return { carrier: -1, offset: TRANSFORM2D_IDENTITY };
    const carrierBody = carrier < 0 ? null : this.bodies[carrier + 1]!;
    for (let above: THREE.Object3D | null = object; above && above !== carrierBody; above = above.parent) {
      const target = this.outsideAt.get(above);
      if (!target) continue;
      const offset = above === object ? TRANSFORM2D_IDENTITY : transformWithin(object, above);
      return { carrier: -1, outsideBone: this.outsideBone(target), offset };
    }
    if (carrierBody) return { carrier, offset: transformWithin(object, carrierBody) };
    return { carrier, offset: canvasTransformOf(object) };
  }
}

/** The global transform of a drawn node as a `real_t` Transform2D holds it. */
function canvasTransformOf(object: THREE.Object3D): Transform2DColumns {
  return storedTransform2D(canvasTransformInto(mutableTransform2D(), object));
}

/**
 * The transform of a drawn node within a drawn node above it, as a `real_t` Transform2D holds it.
 * A chain that folds onto one line bends to the side the last bit of an input picks, so the
 * transform comes from the local matrices, and through the world matrices only as a last resort.
 */
function transformWithin(object: THREE.Object3D, ancestor: THREE.Object3D): Transform2DColumns {
  return storedTransform2D(
    transform2DWithin(object, ancestor) ??
      multiplyTransform2D(affineInverseTransform2D(canvasTransformOf(ancestor)), canvasTransformOf(object))
  );
}
