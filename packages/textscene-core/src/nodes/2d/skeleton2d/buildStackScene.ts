/**
 * The scene a modification stack solves in, read from a Skeleton2D, its bones and the nodes the
 * stack names. A {@link PoseSource} says where the nodes stand: the drawn objects of a render, or the
 * live nodes of the scene file. Each transform is the `real_t` value the scene file stores.
 */

import { TRANSFORM2D_IDENTITY, type Transform2DColumns } from '../../../godot/math/transform2d.js';
import {
  outsideBonesOf,
  type OutsideBone,
  type StackNode,
  type StackPlacement,
  type StackScene,
} from './modificationStack/stackScene.js';
import type { StackTarget } from './skeletonPose.js';
import type { Skeleton2DRig } from './skeletonRig.js';

/**
 * Where the nodes of a solve stand. `Body` is whatever names one: a drawn object, or a live path.
 * Every transform it answers is a `real_t` Transform2D.
 */
export interface PoseSource<Body> {
  /** The global transform of `node`. */
  canvas(node: Body): Transform2DColumns;
  /** The transform of `node` within `ancestor`. */
  within(node: Body, ancestor: Body): Transform2DColumns;
  /** The node above `node`, or null at the top. */
  parent(node: Body): Body | null;
}

/** A bone a solve poses: its node, the local transform it stands with and its parent in the list, or -1. */
export interface PosedBone<Body> {
  node: Body;
  from: Transform2DColumns;
  parent: number;
}

export interface BuiltStackScene<Body> {
  scene: StackScene;
  /** The bones of the skeleton by index, then each outside bone in the order `outsideBonesOf` gives. */
  posed: PosedBone<Body>[];
}

/**
 * The scene of a stack whose targets are `targets`. `bodies` holds the skeleton, then its bones, and
 * `anchorOf` the node at each live path the stack reads that is no bone of the skeleton.
 */
export function buildStackScene<Body>(
  targets: ReadonlyMap<string, StackTarget>,
  rig: Skeleton2DRig,
  bodies: readonly Body[],
  anchorOf: ReadonlyMap<string, Body>,
  source: PoseSource<Body>
): BuiltStackScene<Body> {
  const sceneNodes = new SceneNodes(targets.values(), bodies, anchorOf, source);
  const nodes = new Map<string, StackNode>();
  for (const [literal, target] of targets) nodes.set(literal, sceneNodes.node(target));
  const scene: StackScene = {
    skeletonGlobal: source.canvas(bodies[0]!),
    bones: rig.bones.map(({ parent, reach }) => ({ parent, length: reach.length, boneAngle: reach.angle })),
    nodes,
  };
  const outside = outsideBonesOf(scene);
  const posed: PosedBone<Body>[] = [
    ...rig.bones.map(({ parent }, index) => ({
      node: bodies[index + 1]!,
      from: source.within(bodies[index + 1]!, bodies[parent + 1]!),
      parent,
    })),
    ...outside.map((bone) => ({
      node: sceneNodes.nodeOf(bone),
      from: bone.local,
      parent: bone.parent.outsideBone ? rig.bones.length + outside.indexOf(bone.parent.outsideBone) : -1,
    })),
  ];
  return { scene, posed };
}

/** The nodes a stack names, each read once as the node the solve sees. */
class SceneNodes<Body> {
  /** The target of each Bone2D that is no bone of the skeleton. */
  private readonly outsideAt = new Map<Body, StackTarget>();
  private readonly outsideBones = new Map<StackTarget, OutsideBone>();
  private readonly nodes = new Map<OutsideBone, Body>();

  constructor(
    targets: Iterable<StackTarget>,
    private readonly bodies: readonly Body[],
    private readonly anchorOf: ReadonlyMap<string, Body>,
    private readonly source: PoseSource<Body>
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

  nodeOf(bone: OutsideBone): Body {
    return this.nodes.get(bone)!;
  }

  private outsideBone(target: StackTarget): OutsideBone {
    const made = this.outsideBones.get(target);
    if (made) return made;
    const { parentPath, reach } = target.outsideBone!;
    const node = this.anchorOf.get(target.path)!;
    const above = parentPath === null ? undefined : this.anchorOf.get(parentPath);
    const bone: OutsideBone = {
      parent: this.placement(above, target.carrier),
      local: above ? this.source.within(node, above) : this.source.canvas(node),
      length: reach.length,
      boneAngle: reach.angle,
    };
    this.outsideBones.set(target, bone);
    this.nodes.set(bone, node);
    return bone;
  }

  /**
   * Where `node` sits: below the nearest of the bone `carrier` and an outside bone at or above it,
   * else on the canvas. No node is the canvas itself.
   */
  private placement(node: Body | undefined, carrier: number): StackPlacement {
    if (node === undefined) return { carrier: -1, offset: TRANSFORM2D_IDENTITY };
    const carrierBody = carrier < 0 ? null : this.bodies[carrier + 1]!;
    for (
      let above: Body | null = node;
      above !== null && above !== carrierBody;
      above = this.source.parent(above)
    ) {
      const target = this.outsideAt.get(above);
      if (!target) continue;
      const offset = above === node ? TRANSFORM2D_IDENTITY : this.source.within(node, above);
      return { carrier: -1, outsideBone: this.outsideBone(target), offset };
    }
    if (carrierBody !== null) return { carrier, offset: this.source.within(node, carrierBody) };
    return { carrier, offset: this.source.canvas(node) };
  }
}
