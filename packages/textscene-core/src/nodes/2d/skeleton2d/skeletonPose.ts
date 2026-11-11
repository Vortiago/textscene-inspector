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
import type { StackNode, StackScene } from './modificationStack/stackScene.js';
import type { Skeleton2DRig } from './skeletonRig.js';

/** A node a NodePath of the stack resolves to on the Live scene tree. */
export interface StackTarget {
  /** The live path of the node. */
  path: string;
  /** Whether the node is a Node2D, which alone a modification can aim at. */
  isNode2D: boolean;
}

/** A modification stack with the nodes its NodePaths name. */
export interface BoundStack {
  stack: ModificationStack2D;
  /** The node each NodePath literal of the stack resolves to from the skeleton, by that literal. */
  targets: ReadonlyMap<string, StackTarget>;
}

/** What a Polygon2D skins with. Each object is the pose's own: a reader copies what it keeps. */
export interface DrawnSkeletonPose {
  /** The global transform of the Skeleton2D. */
  skeletonGlobal: Transform2DColumns;
  /** `accum * rest_inverse` of each bone, by skeleton index (`skeleton_2d.cpp:600-602`). */
  boneMatrices: readonly Transform2DColumns[];
  /** Moves each time a transform of the pose moved, and no two poses share a value. */
  version: number;
}

/** The local matrix a bone held before the pose wrote on it. */
interface WrittenBone {
  object: THREE.Object3D;
  matrix: THREE.Matrix4;
  matrixAutoUpdate: boolean;
}

/** Written only by a {@link Skeleton2DPose}, so a reader tells any two states of any poses apart. */
let lastVersion = 0;

export class Skeleton2DPose {
  /** The skeleton, then each bone by skeleton index. */
  private readonly bodies: DrawnNodeFollow;
  /** The Node2Ds the stack names that are no bone of the skeleton, in the order of `anchorPaths`. */
  private readonly anchors: DrawnNodeFollow;
  private readonly anchorPaths: readonly string[];
  /** Written only by {@link write}: null while the stack has not run on the bones as they are drawn. */
  private solved: SolvedPose | null = null;
  /** Written only by {@link write}, and emptied by {@link restore}. */
  private written: WrittenBone[] = [];
  private version = ++lastVersion;
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
        targets.filter(({ path, isNode2D }) => isNode2D && !rig.indexOf.has(path)).map(({ path }) => path)
      ),
    ];
    this.anchors = new DrawnNodeFollow(registry, this.anchorPaths);
    this.boneMatrices = rig.bones.map(() => mutableTransform2D());
  }

  /**
   * Runs before the observers of a render. The world matrices hold the pose of the file or of an
   * animation here, since {@link restore} put it back, so the solve reads it and the bones take
   * the solved pose for this render.
   */
  write(): void {
    const bodies = this.bodies.objects();
    if (!bodies) return;
    const anchors = this.bound ? this.anchors.objects() : null;
    // Both asked, not short-circuited: each watch must see every render.
    const hasBodyMoved = this.bodies.hasMoved();
    const hasAnchorMoved = this.anchors.hasMoved();
    if (hasBodyMoved || hasAnchorMoved) {
      this.version = ++lastVersion;
      this.solved = null;
    }
    if (!this.bound || !anchors) {
      this.solved = null;
      return;
    }
    const cache = cacheLocals(bodies, this.rig);
    this.solved ??= solveStack(this.sceneOf(bodies, anchors), cache, this.bound.stack);
    this.written = writeLocals(bodies, this.rig, cache, this.solved.locals);
  }

  /** Runs once a render has drawn: each bone the pose wrote takes back the matrix it held. */
  restore(): void {
    for (const { object, matrix, matrixAutoUpdate } of this.written) {
      object.matrix.copy(matrix);
      object.matrixAutoUpdate = matrixAutoUpdate;
      // three updates a world matrix only where the local one says it changed.
      object.matrixWorldNeedsUpdate = true;
    }
    this.written = [];
  }

  /**
   * The pose a render draws, for an observer of that render, or null while the skeleton or a bone
   * is not drawn.
   */
  drawn(): DrawnSkeletonPose | null {
    const bodies = this.bodies.objects();
    if (!bodies) return null;
    if (this.matricesVersion !== this.version) {
      this.matricesVersion = this.version;
      this.makeBoneMatrices(bodies);
    }
    return { skeletonGlobal: this.skeletonGlobal, boneMatrices: this.boneMatrices, version: this.version };
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

  private sceneOf(bodies: readonly THREE.Object3D[], anchors: readonly THREE.Object3D[]): StackScene {
    const [skeleton, ...bones] = bodies.map(canvasTransformOf);
    const anchorGlobals = new Map(
      this.anchorPaths.map((path, index) => [path, canvasTransformOf(anchors[index]!)])
    );
    const nodes = new Map<string, StackNode>();
    for (const [literal, target] of this.bound!.targets) {
      nodes.set(literal, this.stackNodeOf(target, bones, anchorGlobals));
    }
    return {
      skeletonGlobal: skeleton!,
      bones: this.rig.bones.map(({ parent, reach }) => ({
        parent,
        length: reach.length,
        boneAngle: reach.angle,
      })),
      nodes,
    };
  }

  private stackNodeOf(
    { path, isNode2D }: StackTarget,
    boneGlobals: readonly Transform2DColumns[],
    anchorGlobals: ReadonlyMap<string, Transform2DColumns>
  ): StackNode {
    const boneIndex = this.rig.indexOf.get(path) ?? -1;
    if (!isNode2D) return { boneIndex, placement: null };
    if (boneIndex >= 0) return { boneIndex, placement: { carrier: boneIndex, offset: TRANSFORM2D_IDENTITY } };
    const global = anchorGlobals.get(path)!;
    const carrier = carrierOf(path, this.rig);
    if (carrier < 0) return { boneIndex, placement: { carrier, offset: global } };
    const offset = multiplyTransform2D(affineInverseTransform2D(boneGlobals[carrier]!), global);
    return { boneIndex, placement: { carrier, offset } };
  }
}

function canvasTransformOf(object: THREE.Object3D): Transform2DColumns {
  return canvasTransformInto(mutableTransform2D(), object);
}

/** The index of the nearest bone above the node at `path`, which carries the node as it moves, or -1. */
function carrierOf(path: string, rig: Skeleton2DRig): number {
  let carrier = -1;
  rig.bones.forEach((bone, index) => {
    const isAbove = path.startsWith(`${bone.path}/`);
    if (isAbove && (carrier < 0 || bone.path.length > rig.bones[carrier]!.path.length)) carrier = index;
  });
  return carrier;
}

/**
 * The local transform of each bone as it is drawn: its global one in the space of its parent bone,
 * or of the skeleton. `bodies` holds the skeleton, then the bones.
 */
function cacheLocals(bodies: readonly THREE.Object3D[], rig: Skeleton2DRig): Transform2DColumns[] {
  const globals = bodies.map(canvasTransformOf);
  return rig.bones.map(({ parent }, index) =>
    multiplyTransform2D(affineInverseTransform2D(globals[parent + 1]!), globals[index + 1]!)
  );
}

/**
 * Writes `solved` on each bone it moves from `cache`, and returns what each such bone held. The
 * drawn matrix of a bone is its Godot local transform behind the wrappers the previewer mounts, so
 * the write keeps them: it undoes the cache transform and applies the solved one.
 */
function writeLocals(
  bodies: readonly THREE.Object3D[],
  rig: Skeleton2DRig,
  cache: readonly Transform2DColumns[],
  solved: readonly Transform2DColumns[]
): WrittenBone[] {
  const written: WrittenBone[] = [];
  rig.bones.forEach((_bone, index) => {
    const from = cache[index]!;
    const to = solved[index]!;
    // A bone with no area has no inverse to undo, and Godot draws nothing below it either.
    if (equalTransform2D(from, to) || transform2DDeterminant(from) === 0) return;
    const object = bodies[index + 1]!;
    written.push({ object, matrix: object.matrix.clone(), matrixAutoUpdate: object.matrixAutoUpdate });
    const turn = threeMatrixFromTransform2D(multiplyTransform2D(affineInverseTransform2D(from), to));
    object.matrix.multiply(turn);
    object.matrixAutoUpdate = false;
  });
  if (written.length === 0) return written;
  // The render already updated the world matrices, so the bones the solve moved update theirs.
  rig.bones.forEach(({ parent }, index) => {
    if (parent < 0) bodies[index + 1]!.updateMatrixWorld(true);
  });
  return written;
}
