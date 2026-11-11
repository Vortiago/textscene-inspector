/**
 * The pose of one drawn Skeleton2D, which the skeleton owns (`skeleton_2d.cpp:592-603`,
 * `:769-815`). It follows the drawn skeleton and bones, runs the modification stack on them before
 * each render reads a transform, and makes each bone matrix once for every Polygon2D the skeleton
 * skins. The solved pose is on the bones only while a render draws: once it ends, each bone holds
 * the pose its file or an AnimationPlayer wrote, which the next solve starts from.
 */

import * as THREE from 'three';
import {
  affineInverseTransform2D,
  affineInverseTransform2DInto,
  equalTransform2D,
  multiplyTransform2D,
  multiplyTransform2DInto,
  mutableTransform2D,
  TRANSFORM2D_IDENTITY,
  transform2DDeterminant,
  type MutableTransform2D,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import type { ModificationStack2D } from '../../../resources/skeleton/skeletonmodificationstack2d/types';
import { DrawnNodeFollow } from '../../../r3f/drawnNodeFollow.js';
import { canvasTransformInto, threeMatrixFromTransform2D } from '../../../r3f/node2dTransform.js';
import { solveStack, type SolvedPose } from './modificationStack/stackRun.js';
import type { StackNode, StackPlacement, StackScene } from './modificationStack/stackScene.js';
import type { Skeleton2DRig } from './skeletonRig.js';

/** A node a NodePath of the stack resolves to on the Live scene tree. */
export interface StackTarget {
  /** The live path of the node. */
  path: string;
  /** Whether the node is a Node2D, which alone a modification can aim at. */
  isNode2D: boolean;
  /** The index of the node in the rig of the skeleton, or -1 for a node that is no bone of it. */
  boneIndex: number;
  /** The index of a Bone2D in the skeleton it joins, or -1 where it joins none. Null for another type. */
  indexInSkeleton: number | null;
  /** The index of the nearest bone above the node, which carries the node as it moves, or -1. */
  carrier: number;
}

/** A modification stack with the nodes its NodePaths name. */
export interface BoundStack {
  stack: ModificationStack2D;
  /** The node each NodePath literal of the stack resolves to from the skeleton, by that literal. */
  targets: ReadonlyMap<string, StackTarget>;
}

/**
 * What a Polygon2D skins with. The object and its transforms are the pose's own for as long as the
 * pose lives: a reader copies what it keeps.
 */
export interface DrawnSkeletonPose {
  /** The global transform of the Skeleton2D. */
  readonly skeletonGlobal: Transform2DColumns;
  /** `accum * rest_inverse` of each bone, by skeleton index (`skeleton_2d.cpp:600-602`). */
  readonly boneMatrices: readonly Transform2DColumns[];
  /** Moves each time a transform of this pose moved. */
  readonly version: number;
}

/** A bone the solved pose moves from the pose it is drawn with. */
interface MovedBone {
  object: THREE.Object3D;
  /** Takes the drawn local matrix of the bone to the solved one. */
  turn: THREE.Matrix4;
  /** Whether no bone above this one moves, so its world update reaches every moved bone below. */
  isTopmost: boolean;
  /** Written by each write: the local matrix the bone held, which the restore puts back. */
  held: THREE.Matrix4;
  heldAutoUpdate: boolean;
}

export class Skeleton2DPose {
  /** The skeleton, then each bone by skeleton index. */
  private readonly bodies: DrawnNodeFollow;
  /** The Node2Ds the stack names that are no bone of the skeleton, in the order of `anchorPaths`. */
  private readonly anchors: DrawnNodeFollow;
  private readonly anchorPaths: readonly string[];
  /** Written only by {@link write}: what `bodies` found for the render under way. */
  private drawnBodies: readonly THREE.Object3D[] | null = null;
  /** Written only by {@link write}: null while the stack has not run on the bones as they are drawn. */
  private solved: SolvedPose | null = null;
  /** Written with `solved`: the bones it moves. */
  private moved: MovedBone[] = [];
  /** Whether the moved bones hold the solved pose now. Set by {@link write}, cleared by {@link restore}. */
  private isWritten = false;
  /** The one object {@link drawn} hands out. Its version moves in {@link write}. */
  private readonly pose: { -readonly [K in keyof DrawnSkeletonPose]: DrawnSkeletonPose[K] };
  /** The version {@link drawn} last made the bone matrices at. */
  private matricesVersion = -1;
  private readonly skeletonGlobal = mutableTransform2D();
  private readonly skeletonInverse = mutableTransform2D();
  private readonly boneMatrices: MutableTransform2D[];

  constructor(
    private readonly rig: Skeleton2DRig,
    skeletonPath: string,
    registry: ReadonlyMap<string, THREE.Object3D>,
    private readonly bound: BoundStack | null
  ) {
    this.bodies = new DrawnNodeFollow(registry, [skeletonPath, ...rig.bones.map((bone) => bone.path)]);
    const targets = [...(bound?.targets.values() ?? [])];
    this.anchorPaths = [
      ...new Set(
        targets.filter(({ isNode2D, boneIndex }) => isNode2D && boneIndex < 0).map(({ path }) => path)
      ),
    ];
    this.anchors = new DrawnNodeFollow(registry, this.anchorPaths);
    this.boneMatrices = rig.bones.map(() => mutableTransform2D());
    this.pose = { skeletonGlobal: this.skeletonGlobal, boneMatrices: this.boneMatrices, version: 0 };
  }

  /**
   * Runs before the observers of a render. The solve reads the pose of the file or of an animation
   * from the world matrices, and the bones take the solved pose for this render.
   */
  write(): void {
    this.unsolveWorld();
    const bodies = (this.drawnBodies = this.bodies.objects());
    if (!bodies) return;
    const anchors = this.bound ? this.anchors.objects() : null;
    // Both asked, not short-circuited: each watch must see every render.
    const hasBodyMoved = this.bodies.hasMoved(bodies);
    const hasAnchorMoved = anchors !== null && this.anchors.hasMoved(anchors);
    if (hasBodyMoved || hasAnchorMoved) {
      this.pose.version++;
      this.forgetSolve();
    }
    if (!this.bound || !anchors) return this.forgetSolve();
    if (!this.solved) this.solve(bodies, anchors, this.bound.stack);
    this.writeMoved();
  }

  /** Runs once a render has drawn: each bone the pose wrote takes back the matrix it held. */
  restore(): void {
    if (!this.isWritten) return;
    this.isWritten = false;
    for (const { object, held, heldAutoUpdate } of this.moved) {
      object.matrix.copy(held);
      object.matrixAutoUpdate = heldAutoUpdate;
      // three updates a world matrix only where the local one says it changed.
      object.matrixWorldNeedsUpdate = true;
    }
  }

  /**
   * The pose a render draws, for an observer of that render, or null while the skeleton or a bone
   * is not drawn.
   */
  drawn(): DrawnSkeletonPose | null {
    if (!this.drawnBodies) return null;
    if (this.matricesVersion !== this.pose.version) {
      this.matricesVersion = this.pose.version;
      this.makeBoneMatrices(this.drawnBodies);
    }
    return this.pose;
  }

  /**
   * Whether a modification holds the bone at `bone`, which Godot marks with the meta
   * `_local_pose_override_enabled_`. Undefined for a skeleton with no stack, which sets and removes
   * no meta, so the one of the file stands (`skeleton_2d.cpp:786-803`).
   */
  holds(bone: number): boolean | undefined {
    if (!this.bound) return undefined;
    return this.solved?.isOverridden[bone] ?? false;
  }

  /** A bone joins its skeleton through Bone2D parents only, so it draws in the skeleton's canvas. */
  private makeBoneMatrices([skeleton, ...bones]: readonly THREE.Object3D[]): void {
    canvasTransformInto(this.skeletonGlobal, skeleton!);
    affineInverseTransform2DInto(this.skeletonInverse, this.skeletonGlobal);
    bones.forEach((bone, index) => {
      const matrix = canvasTransformInto(this.boneMatrices[index]!, bone);
      multiplyTransform2DInto(matrix, this.skeletonInverse, matrix);
      multiplyTransform2DInto(matrix, matrix, this.rig.bones[index]!.restInverse);
    });
  }

  /**
   * Takes the solved pose off the world matrices that still hold it. A render that keeps the
   * matrices of the scene, such as the second buffer of a 2D light, updates none after
   * {@link restore}, and the solve would read its own result as the pose of the file.
   */
  private unsolveWorld(): void {
    for (const { object, isTopmost } of this.moved) {
      // three clears the flag where it updates a world matrix, so a set one marks a stale matrix.
      if (isTopmost && object.matrixWorldNeedsUpdate) object.updateMatrixWorld(true);
    }
  }

  private forgetSolve(): void {
    this.solved = null;
    this.moved = [];
  }

  /** Runs the stack on the bodies as they are drawn. A render with nothing moved keeps the result. */
  private solve(
    bodies: readonly THREE.Object3D[],
    anchors: readonly THREE.Object3D[],
    stack: ModificationStack2D
  ): void {
    const globals = bodies.map(canvasTransformOf);
    const cache = cacheLocals(globals, this.rig);
    this.solved = solveStack(this.sceneOf(globals, anchors), cache, stack);
    this.moved = movedBones(bodies, this.rig, cache, this.solved.locals);
  }

  /**
   * Puts the solved pose on the moved bones. The drawn matrix of a bone is its Godot local transform
   * behind the wrappers the previewer mounts, so the write keeps them and applies only the turn.
   */
  private writeMoved(): void {
    for (const bone of this.moved) {
      bone.held.copy(bone.object.matrix);
      bone.heldAutoUpdate = bone.object.matrixAutoUpdate;
      bone.object.matrix.multiply(bone.turn);
      bone.object.matrixAutoUpdate = false;
    }
    // The render already updated the world matrices, so the bones the solve moved update theirs.
    for (const bone of this.moved) if (bone.isTopmost) bone.object.updateMatrixWorld(true);
    this.isWritten = this.moved.length > 0;
  }

  private sceneOf(
    [skeletonGlobal, ...boneGlobals]: readonly Transform2DColumns[],
    anchors: readonly THREE.Object3D[]
  ): StackScene {
    const anchorGlobals = new Map(
      this.anchorPaths.map((path, index) => [path, canvasTransformOf(anchors[index]!)])
    );
    const nodes = new Map<string, StackNode>();
    for (const [literal, target] of this.bound!.targets) {
      nodes.set(literal, stackNodeOf(target, boneGlobals, anchorGlobals));
    }
    return {
      skeletonGlobal: skeletonGlobal!,
      bones: this.rig.bones.map(({ parent, reach }) => ({
        parent,
        length: reach.length,
        boneAngle: reach.angle,
      })),
      nodes,
    };
  }
}

function stackNodeOf(
  target: StackTarget,
  boneGlobals: readonly Transform2DColumns[],
  anchorGlobals: ReadonlyMap<string, Transform2DColumns>
): StackNode {
  const { boneIndex, indexInSkeleton } = target;
  return { boneIndex, indexInSkeleton, placement: placementOf(target, boneGlobals, anchorGlobals) };
}

function placementOf(
  { path, isNode2D, boneIndex, carrier }: StackTarget,
  boneGlobals: readonly Transform2DColumns[],
  anchorGlobals: ReadonlyMap<string, Transform2DColumns>
): StackPlacement | null {
  if (!isNode2D) return null;
  if (boneIndex >= 0) return { carrier: boneIndex, offset: TRANSFORM2D_IDENTITY };
  const global = anchorGlobals.get(path)!;
  if (carrier < 0) return { carrier, offset: global };
  return { carrier, offset: multiplyTransform2D(affineInverseTransform2D(boneGlobals[carrier]!), global) };
}

function canvasTransformOf(object: THREE.Object3D): Transform2DColumns {
  return canvasTransformInto(mutableTransform2D(), object);
}

/**
 * The local transform of each bone as it is drawn: its global one in the space of its parent bone,
 * or of the skeleton. `globals` holds the skeleton, then the bones.
 */
function cacheLocals(globals: readonly Transform2DColumns[], rig: Skeleton2DRig): Transform2DColumns[] {
  return rig.bones.map(({ parent }, index) =>
    multiplyTransform2D(affineInverseTransform2D(globals[parent + 1]!), globals[index + 1]!)
  );
}

/** The bones `solved` moves from `cache`, each with the turn between the two. `bodies` holds the skeleton first. */
function movedBones(
  bodies: readonly THREE.Object3D[],
  rig: Skeleton2DRig,
  cache: readonly Transform2DColumns[],
  solved: readonly Transform2DColumns[]
): MovedBone[] {
  // A bone with no area has no inverse to undo, and Godot draws nothing below it either.
  const isMoved = rig.bones.map(
    (_bone, index) =>
      !equalTransform2D(cache[index]!, solved[index]!) && transform2DDeterminant(cache[index]!) !== 0
  );
  const hasMovedAncestor = (index: number): boolean => {
    const { parent } = rig.bones[index]!;
    return parent >= 0 && (isMoved[parent]! || hasMovedAncestor(parent));
  };
  return rig.bones.flatMap((_bone, index) => {
    if (!isMoved[index]) return [];
    const turn = multiplyTransform2D(affineInverseTransform2D(cache[index]!), solved[index]!);
    return {
      object: bodies[index + 1]!,
      turn: threeMatrixFromTransform2D(turn),
      isTopmost: !hasMovedAncestor(index),
      held: new THREE.Matrix4(),
      heldAutoUpdate: true,
    };
  });
}
