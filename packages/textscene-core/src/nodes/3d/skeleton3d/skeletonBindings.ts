/**
 * The Skeleton3D scene pass. A MeshInstance3D that names a Skeleton3D through `skeleton` binds to
 * the automatic skin of that skeleton, or to the Skin it sets through `skin`
 * (`MeshInstance3D::_resolve_skeleton_path`, `mesh_instance_3d.cpp:175-199`). The component cannot
 * reach the skeleton, so this pass poses each skeleton once and hands the mesh its skin by its live
 * path. The component reads the Skin resource and asks the skin for it with `withSkin`. It runs on
 * the live stage (ADR-0060), as Godot resolves the path on the live tree, across an instance border too. The SkeletonModifier3D
 * children of the skeleton edit the pose first, in child order, and so do they on the pose that an
 * AnimationPlayer writes to a bone.
 */

import type { TscnNode } from '../../../parser/types.js';
import { identityTransform3D, sameTransform3D, type Transform3D } from '../../../godot/math/transform3d.js';
import { resolveNodePathLiteral } from '../../../godot/string/nodePath.js';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry.js';
import type { LiveLink, LiveTree } from '../../../r3f/liveSceneTree.js';
import { liveGlobalTransform3D } from '../../../r3f/liveGlobalTransform.js';
import { uniquePathsOfLiteral } from '../../../r3f/nodePathUniqueNames.js';
import { liveNodePatches } from '../../../r3f/liveNodePatches.js';
import { liveScenePassResults } from '../../../r3f/liveScenePass.js';
import type { NodePatches } from '../../../r3f/nodePatch.js';
import type { SkinBind } from '../../../resources/skin/types.js';
import { sameElements } from '../../../utils/sameElements.js';
import { perObject } from '../../../utils/perObject.js';
import { warnOnce } from '../../../utils/warnOnce.js';
import type { MeshInstance3DProperties } from '../meshinstance3d/types.js';
import {
  animationPass,
  automaticSkinMatrices,
  BonePoses,
  poseUnder,
  type AnimatedPose,
  type PoseModifier,
  type SkinBinding,
} from './skeletonPose.js';
import type { Skeleton3DProperties } from './types.js';

/** The skin that moves a mesh, in the file pose and under an animation. */
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
 * The automatic skin a Skeleton3D gives the meshes bound to it. A mesh that sets a Skin binds to the
 * same skeleton and takes {@link AutomaticSkin.withSkin}.
 */
export interface AutomaticSkin extends BoundSkin {
  /**
   * The skin the Skin `binds` give on this skeleton: one matrix for each bind, in bind order
   * (`skeleton_3d.cpp:363-403`). A bind that finds no bone binds bone 0 and warns once.
   */
  withSkin(binds: readonly SkinBind[]): BoundSkin;
}

/**
 * The skin of every MeshInstance3D in `tree` bound to a Skeleton3D, by the mesh's live path. A node
 * that writes no `skeleton` binds nothing, as Godot's default is empty unless the project turns on
 * `default_parent_skeleton_in_mesh_instance_3d` (`mesh_instance_3d.cpp:937`). A path that is empty,
 * absolute, resolves to no node, or names a node that is not a Skeleton3D binds nothing.
 */
export function bindMeshesToSkeletons(tree: LiveTree): ReadonlyMap<string, AutomaticSkin> {
  const skins = new Map<string, AutomaticSkin>();
  const skeletonSkins = new Map<string, AutomaticSkin>();
  tree.fold<void, void>(undefined, ({ step, path }, _, descend) => {
    const skin = boundSkinOf(step.node, path, tree, skeletonSkins);
    if (skin) skins.set(path, skin);
    descend();
  });
  return skins;
}

/** Whether a MeshInstance3D with `properties` can bind a skeleton: it names one. */
export function namesSkeletonToBind(
  properties: MeshInstance3DProperties
): properties is MeshInstance3DProperties & { skeleton: string } {
  return properties.skeleton !== undefined;
}

/** The skin of the node at `path` where it is a MeshInstance3D bound to a Skeleton3D, else undefined. */
function boundSkinOf(
  node: TscnNode,
  path: string,
  tree: LiveTree,
  skeletonSkins: Map<string, AutomaticSkin>
): AutomaticSkin | undefined {
  if (node.type !== 'MeshInstance3D') return undefined;
  const properties = node.properties as MeshInstance3DProperties;
  if (!namesSkeletonToBind(properties)) return undefined;
  const skeletonPath = resolveNodePathLiteral(
    path,
    properties.skeleton,
    uniquePathsOfLiteral(properties.skeleton, path, tree)
  );
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

function modifiersOf(skeleton: LiveLink, tree: LiveTree, placed: NodePatches): Modifiers {
  const modifiers: Modifiers = { edits: [], nodes: [], skeletonGlobal: null, reads: [] };
  tree.fold<void, void>(
    undefined,
    ({ step, path: modifierPath }) => {
      const reader = nodeComponentRegistry.poseModifierOf(step.node.type);
      if (!reader) return;
      modifiers.skeletonGlobal ??=
        liveGlobalTransform3D(tree, skeleton.path, placed) ?? identityTransform3D();
      const edit = reader(step.node, {
        skeletonGlobal: modifiers.skeletonGlobal,
        nodeGlobal: (target) => {
          const earlier = modifiers.reads.find(
            (read) => read.modifierPath === modifierPath && read.target === target
          );
          if (earlier) return earlier.global;
          const global = referenceNodeGlobal(tree, placed, modifierPath, target);
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
function readsHold(previous: Modifiers, current: Modifiers, tree: LiveTree, placed: NodePatches): boolean {
  return (
    sameWorld(previous.skeletonGlobal, current.skeletonGlobal) &&
    previous.reads.every((read) =>
      sameWorld(read.global, referenceNodeGlobal(tree, placed, read.modifierPath, read.target))
    )
  );
}

/** The global transform of the Node3D that `target` names from the modifier at `modifierPath`. */
function referenceNodeGlobal(
  tree: LiveTree,
  placed: NodePatches,
  modifierPath: string,
  target: string
): Transform3D | null {
  const resolved = resolveNodePathLiteral(
    modifierPath,
    target,
    uniquePathsOfLiteral(target, modifierPath, tree)
  );
  return resolved === null ? null : liveGlobalTransform3D(tree, resolved, placed);
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
  skin: AutomaticSkin;
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
function skinOf(skeleton: LiveLink, tree: LiveTree): AutomaticSkin {
  // Where the nodes stand once a RemoteTransform has moved them, as a modifier reads them.
  const placed = liveScenePassResults(liveNodePatches, tree);
  const modifiers = modifiersOf(skeleton, tree, placed);
  const kept = keptSkins(skeleton.step.node);
  const previous = kept.get(skeleton.path);
  if (
    previous &&
    sameElements(previous.modifiers.nodes, modifiers.nodes) &&
    readsHold(previous.modifiers, modifiers, tree, placed)
  ) {
    return previous.skin;
  }
  const skin = boundSkin(skeleton, modifiers.edits);
  kept.set(skeleton.path, { modifiers, skin });
  return skin;
}

function boundSkin(skeleton: LiveLink, modifiers: readonly PoseModifier[]): AutomaticSkin {
  const { bones, showRestOnly, motionScale } = skeleton.step.node.properties as Skeleton3DProperties;
  // One pose editor for the skeleton: each frame starts it again from the file pose.
  const poses = new BonePoses(bones, showRestOnly);
  const warnUnknownBone = (name: string) =>
    warnOnce(
      skin,
      name,
      `[AnimationPlayer] the Skeleton3D at ${skeleton.path} has no bone "${name}", so its track binds nothing`
    );
  // The pose `poses` holds once the edits of one clip pose ran on it, null for the file pose. Every
  // skin of the skeleton shares it, so the edits run once for each pose however many skins ask.
  let preparedFor: AnimatedPose | null | undefined;
  const prepare = (pose: AnimatedPose | null): BonePoses => {
    if (pose !== preparedFor) {
      preparedFor = pose;
      poseUnder(poses, pose ? [animationPass(pose, motionScale, warnUnknownBone), ...modifiers] : modifiers);
    }
    return poses;
  };
  /** The matrices of `bindings` (the automatic ones where undefined) under each pose, kept for the last. */
  const matricesUnderOf = (bindings?: readonly SkinBinding[]): BoundSkin['matricesUnder'] => {
    let lastPose: AnimatedPose | undefined;
    let lastMatrices: readonly Transform3D[] = [];
    return (pose) => {
      if (pose === lastPose) return lastMatrices;
      lastPose = pose;
      const posed = prepare(pose);
      lastMatrices = bindings ? posed.bindMatrices(bindings) : posed.skinMatrices();
      return lastMatrices;
    };
  };
  /** One skin for each decoded Skin, shared by every mesh that sets it. */
  const skinsOfBinds = new WeakMap<readonly SkinBind[], BoundSkin>();
  const skinOfBinds = (binds: readonly SkinBind[]): BoundSkin => {
    const kept = skinsOfBinds.get(binds);
    if (kept) return kept;
    const bindings = poses.resolveBinds(binds, (message) =>
      warnOnce(binds, message, `[MeshInstance3D] the Skeleton3D at ${skeleton.path}: ${message}`)
    );
    const bound: BoundSkin = {
      skeletonPath: skeleton.path,
      matrices: prepare(null).bindMatrices(bindings),
      matricesUnder: matricesUnderOf(bindings),
    };
    skinsOfBinds.set(binds, bound);
    return bound;
  };
  const skin: AutomaticSkin = {
    skeletonPath: skeleton.path,
    matrices:
      modifiers.length === 0
        ? automaticSkinOf(skeleton.step.node)
        : automaticSkinMatrices(bones, showRestOnly, modifiers),
    matricesUnder: matricesUnderOf(),
    withSkin: skinOfBinds,
  };
  return skin;
}
