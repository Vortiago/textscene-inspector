/**
 * The Skeleton3D scene pass. A MeshInstance3D that names a Skeleton3D through `skeleton`, and sets
 * no `skin`, binds to the automatic skin of that skeleton (`MeshInstance3D::_resolve_skeleton_path`,
 * `mesh_instance_3d.cpp:175-199`). The component cannot reach the skeleton, so this pass poses each
 * skeleton once and hands the mesh its skin by its live path. It runs on the live stage (ADR-0060),
 * as Godot resolves the path on the live tree, across an instance border too. The SkeletonModifier3D
 * children of the skeleton edit the pose first, in child order, and so do they on the pose that an
 * AnimationPlayer writes to a bone.
 */

import type { TscnNode } from '../../../parser/types.js';
import { identityTransform3D, sameTransform3D, type Transform3D } from '../../../godot/math/transform3d.js';
import { resolveNodePathLiteral, UNIQUE_NODE_PREFIX } from '../../../godot/string/nodePath.js';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry.js';
import type { LiveLink, LiveTree } from '../../../r3f/liveSceneTree.js';
import { liveGlobalTransform3D } from '../../../r3f/liveGlobalTransform.js';
import { nodePathUniquePaths } from '../../../r3f/nodePathUniqueNames.js';
import { sameElements } from '../../../utils/sameElements.js';
import { perObject } from '../../../utils/perObject.js';
import { warnOnce } from '../../../utils/warnOnce.js';
import type { MeshInstance3DProperties } from '../meshinstance3d/types.js';
import {
  animationPass,
  automaticSkinMatrices,
  type AnimatedPose,
  type PoseModifier,
} from './skeletonPose.js';
import type { Skeleton3DProperties } from './types.js';

/** The skin a Skeleton3D gives the meshes bound to it, in the file pose and under an animation. */
export interface BoundSkin {
  /** The live path of the Skeleton3D, which a bone track of an AnimationPlayer resolves to. */
  skeletonPath: string;
  /** One matrix for each bone, in the pose of the file. */
  matrices: readonly Transform3D[];
  /**
   * The matrices when `pose` replaces the parts of the bone poses that it writes and the modifiers
   * run on the result. The same `pose` answers the same array, so meshes bound to one skeleton share it.
   */
  matricesUnder(pose: AnimatedPose): readonly Transform3D[];
}

/**
 * The skin of every MeshInstance3D in `tree` bound to a Skeleton3D, by the mesh's live path. A node
 * that writes no `skeleton` binds nothing, as Godot's default is empty unless the project turns on
 * `default_parent_skeleton_in_mesh_instance_3d` (`mesh_instance_3d.cpp:937`). A path that is empty,
 * absolute, resolves to no node, or names a node that is not a Skeleton3D binds nothing, and so does
 * a node with a `skin`, which this pass does not read.
 */
export function bindMeshesToSkeletons(tree: LiveTree): ReadonlyMap<string, BoundSkin> {
  const skins = new Map<string, BoundSkin>();
  const skeletonSkins = new Map<string, BoundSkin>();
  tree.fold<void, void>(undefined, ({ step, path }, _, descend) => {
    const skin = boundSkinOf(step.node, path, tree, skeletonSkins);
    if (skin) skins.set(path, skin);
    descend();
  });
  return skins;
}

/** Whether a MeshInstance3D with `properties` can bind a skeleton: it names one and sets no `skin`. */
export function namesSkeletonToBind(
  properties: MeshInstance3DProperties
): properties is MeshInstance3DProperties & { skeleton: string } {
  return properties.skin === undefined && properties.skeleton !== undefined;
}

/** The skin of the node at `path` where it is a MeshInstance3D bound to a Skeleton3D, else undefined. */
function boundSkinOf(
  node: TscnNode,
  path: string,
  tree: LiveTree,
  skeletonSkins: Map<string, BoundSkin>
): BoundSkin | undefined {
  if (node.type !== 'MeshInstance3D') return undefined;
  const properties = node.properties as MeshInstance3DProperties;
  if (!namesSkeletonToBind(properties)) return undefined;
  // Only a `%Name` segment reads the table, which allocates for each bound mesh on each load.
  const uniquePaths = properties.skeleton.includes(UNIQUE_NODE_PREFIX)
    ? nodePathUniquePaths(path, tree.roots, tree.ctx)
    : undefined;
  const skeletonPath = resolveNodePathLiteral(path, properties.skeleton, uniquePaths);
  const skeleton = skeletonPath === null ? null : tree.at(skeletonPath);
  if (skeleton?.step.node.type !== 'Skeleton3D') return undefined;
  const known = skeletonSkins.get(skeleton.path);
  if (known) return known;
  const skin = skinOf(skeleton, tree);
  skeletonSkins.set(skeleton.path, skin);
  return skin;
}

/** The global transform of the node that `target` names from the modifier at `modifierPath`, as a modifier read it. */
interface NodeRead {
  modifierPath: string;
  target: string;
  global: Transform3D | null;
}

/**
 * The pose edit of each SkeletonModifier3D child of a skeleton that makes one, in child order, and
 * what the edits read: the modifier nodes, the global transform of the skeleton, and each node of
 * the scene they ask for. An edit asks when it runs, so `reads` fills after the edits are made, and
 * a node asked for again answers what it answered first: the edits of a skin always see one scene.
 */
interface Modifiers {
  edits: PoseModifier[];
  nodes: TscnNode[];
  skeletonGlobal: Transform3D | null;
  reads: NodeRead[];
}

function modifiersOf(skeleton: LiveLink, tree: LiveTree): Modifiers {
  const modifiers: Modifiers = { edits: [], nodes: [], skeletonGlobal: null, reads: [] };
  tree.fold<void, void>(
    undefined,
    ({ step, path: modifierPath }) => {
      const reader = nodeComponentRegistry.poseModifierOf(step.node.type);
      if (!reader) return;
      modifiers.skeletonGlobal ??= liveGlobalTransform3D(tree, skeleton.path) ?? identityTransform3D();
      const edit = reader(step.node, {
        skeletonGlobal: modifiers.skeletonGlobal,
        nodeGlobal: (target) => {
          const earlier = modifiers.reads.find(
            (read) => read.modifierPath === modifierPath && read.target === target
          );
          if (earlier) return earlier.global;
          const global = referenceNodeGlobal(tree, modifierPath, target);
          modifiers.reads.push({ modifierPath, target, global });
          return global;
        },
      });
      modifiers.nodes.push(step.node);
      if (edit) modifiers.edits.push(edit);
    },
    skeleton
  );
  return modifiers;
}

/** Whether the scene `tree` holds answers each read of `previous` as it did, so its edits would make the same pose. */
function readsHold(previous: Modifiers, current: Modifiers, tree: LiveTree): boolean {
  return (
    sameWorld(previous.skeletonGlobal, current.skeletonGlobal) &&
    previous.reads.every((read) =>
      sameWorld(read.global, referenceNodeGlobal(tree, read.modifierPath, read.target))
    )
  );
}

/** The global transform of the Node3D that `target` names from the modifier at `modifierPath`. */
function referenceNodeGlobal(tree: LiveTree, modifierPath: string, target: string): Transform3D | null {
  const uniquePaths = target.includes(UNIQUE_NODE_PREFIX)
    ? nodePathUniquePaths(modifierPath, tree.roots, tree.ctx)
    : undefined;
  const resolved = resolveNodePathLiteral(modifierPath, target, uniquePaths);
  return resolved === null ? null : liveGlobalTransform3D(tree, resolved);
}

function sameWorld(a: Transform3D | null, b: Transform3D | null): boolean {
  return a === b || (a !== null && b !== null && sameTransform3D(a, b));
}

/**
 * One skin for each Skeleton3D node with no modifier child, shared by every mesh bound to it. A
 * load that leaves the node as it is hands back the same skin, so a bound mesh does not draw again.
 */
const automaticSkinOf = perObject((skeleton: TscnNode): readonly Transform3D[] => {
  const { bones, showRestOnly } = skeleton.properties as Skeleton3DProperties;
  return automaticSkinMatrices(bones, showRestOnly);
});

/** What a bound skin was made of, which a load compares to tell whether the skin is still true. */
interface KeptSkin {
  modifiers: Modifiers;
  skin: BoundSkin;
}

/**
 * Written only by `skinOf`: the previous skin of each Skeleton3D node at each live path. A modifier
 * reads the scene around the skeleton, so two instances of one node pose differently. The entries
 * clear when nothing holds the node any more.
 */
const keptSkins = perObject(() => new Map<string, KeptSkin>());

/**
 * The skin of the Skeleton3D at `skeleton`: the file pose, edited by the modifiers below it. A load
 * that leaves the node, the modifier nodes and what they read as they were hands back the same
 * skin, whose animated poses run the modifiers it holds, so they must be the ones the load would make.
 */
function skinOf(skeleton: LiveLink, tree: LiveTree): BoundSkin {
  const modifiers = modifiersOf(skeleton, tree);
  const kept = keptSkins(skeleton.step.node);
  const previous = kept.get(skeleton.path);
  if (
    previous &&
    sameElements(previous.modifiers.nodes, modifiers.nodes) &&
    readsHold(previous.modifiers, modifiers, tree)
  ) {
    return previous.skin;
  }
  const skin = boundSkin(skeleton, modifiers.edits);
  kept.set(skeleton.path, { modifiers, skin });
  return skin;
}

function boundSkin(skeleton: LiveLink, modifiers: readonly PoseModifier[]): BoundSkin {
  const { bones, showRestOnly, motionScale } = skeleton.step.node.properties as Skeleton3DProperties;
  let lastPose: AnimatedPose | undefined;
  let lastMatrices: readonly Transform3D[] = [];
  const skin: BoundSkin = {
    skeletonPath: skeleton.path,
    matrices:
      modifiers.length === 0
        ? automaticSkinOf(skeleton.step.node)
        : automaticSkinMatrices(bones, showRestOnly, modifiers),
    matricesUnder: (pose) => {
      if (pose === lastPose) return lastMatrices;
      const warnUnknownBone = (name: string) =>
        warnOnce(
          skin,
          name,
          `[AnimationPlayer] the Skeleton3D at ${skeleton.path} has no bone "${name}", so its track binds nothing`
        );
      lastPose = pose;
      lastMatrices = automaticSkinMatrices(bones, showRestOnly, [
        animationPass(pose, motionScale, warnUnknownBone),
        ...modifiers,
      ]);
      return lastMatrices;
    },
  };
  return skin;
}
