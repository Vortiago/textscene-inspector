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
  transform2DDeterminant,
  type MutableTransform2D,
  type Transform2DColumns,
} from '../../../godot/math/transform2d.js';
import type { BoneReach } from '../bone2d/boneReach.js';
import type { ModificationStack2D } from '../../../resources/skeleton/skeletonmodificationstack2d/types';
import { DrawnNodeFollow } from '../../../r3f/drawnNodeFollow.js';
import { WorldMatrixWatch } from '../../../r3f/worldMatrixWatch.js';
import { canvasTransformInto, threeMatrixFromTransform2D } from '../../../r3f/node2dTransform.js';
import { solveStack, type SolvedPose } from './modificationStack/stackRun.js';
import { drawnStackScene, type PosedBone } from './drawnStackScene.js';
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
  /** For a Bone2D that is no bone of this skeleton: the live path of the node above it, and its reach. */
  outsideBone: { parentPath: string | null; reach: BoneReach } | null;
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
  /**
   * The Node2Ds the stack names that are no bone of the skeleton, and the node above each outside
   * bone, in the order of `anchorPaths`.
   */
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
  /** Read only by {@link drawn}: whether a body moved since it last made the bone matrices. */
  private readonly drawnWatch = new WorldMatrixWatch();
  /** Cleared by {@link write}, set by {@link drawn}: one read of `drawnWatch` serves every skin of a render. */
  private hasWatchedDrawn = false;
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
    const named = targets.filter(({ isNode2D, boneIndex }) => isNode2D && boneIndex < 0);
    const abovePaths = targets.flatMap(({ outsideBone }) => outsideBone?.parentPath ?? []);
    this.anchorPaths = [...new Set([...named.map(({ path }) => path), ...abovePaths])];
    this.anchors = new DrawnNodeFollow(registry, this.anchorPaths);
    this.boneMatrices = rig.bones.map(() => mutableTransform2D());
    this.pose = { skeletonGlobal: this.skeletonGlobal, boneMatrices: this.boneMatrices, version: 0 };
  }

  /**
   * Runs before the observers of a render. The solve reads the pose of the file or of an animation
   * from the world matrices, and the bones take the solved pose for this render.
   */
  write(): void {
    // A render that threw ran no restore, and a second write would hold the solved pose as the drawn one.
    this.restore();
    this.unsolveWorld();
    this.hasWatchedDrawn = false;
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
    if (!this.bound || !anchors) {
      // A solve that stops with nothing moved, as an anchor leaves the tree, still moves the bone matrices.
      if (this.solved) this.pose.version++;
      return this.forgetSolve();
    }
    if (!this.solved) this.solve(bodies, anchors, this.bound);
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
    // The stack of another skeleton can move these bones once this pose has written, and every
    // pose writes before the first observer reads one.
    if (!this.hasWatchedDrawn && this.drawnWatch.hasMoved(this.drawnBodies)) this.pose.version++;
    this.hasWatchedDrawn = true;
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
    { stack, targets }: BoundStack
  ): void {
    const anchorOf = new Map(this.anchorPaths.map((path, index) => [path, anchors[index]!]));
    const { scene, posed } = drawnStackScene(targets, this.rig, bodies, anchorOf);
    const cache = posed.slice(0, this.rig.bones.length).map(({ from }) => from);
    this.solved = solveStack(scene, cache, stack);
    this.moved = movedBones(posed, this.solved.locals);
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
}

/** The bones of `posed` that `solved` moves, each with the turn from the transform it is drawn with. */
function movedBones(posed: readonly PosedBone[], solved: readonly Transform2DColumns[]): MovedBone[] {
  // A bone with no area has no inverse to undo, and Godot draws nothing below it either.
  const isMoved = posed.map(
    ({ from }, index) => !equalTransform2D(from, solved[index]!) && transform2DDeterminant(from) !== 0
  );
  const hasMovedAncestor = (index: number): boolean => {
    const { parent } = posed[index]!;
    return parent >= 0 && (isMoved[parent]! || hasMovedAncestor(parent));
  };
  return posed.flatMap(({ object, from }, index) => {
    if (!isMoved[index]) return [];
    const turn = multiplyTransform2D(affineInverseTransform2D(from), solved[index]!);
    return {
      object,
      turn: threeMatrixFromTransform2D(turn),
      isTopmost: !hasMovedAncestor(index),
      held: new THREE.Matrix4(),
      heldAutoUpdate: true,
    };
  });
}
