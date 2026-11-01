/**
 * The BoneAttachment3D scene pass. An attachment rides the global pose of the bone `get_skeleton`
 * reaches (`bone_attachment_3d.cpp:128-142`), with `_check_bind` resolving the index against the
 * bone table (`:113-126`) and `on_skeleton_update` (`:294-322`) composing the seat: the pose for
 * its own under a parented skeleton, or the skeleton's global with the pose where
 * `use_external_skeleton` is set. The posed skeleton is the one the skin pass runs the modifiers
 * and the bone tracks a clip writes on, so the pose is never computed twice in two ways. It runs
 * on the live stage (ADR-0060), across an instance border too. Semantics are Godot 4.6.3, no
 * THREE object in the pass, as the pose model is.
 */

import { parentPathOf } from '../../../../utils/nodePath.js';
import {
  affineInverseTransform3D,
  identityTransform3D,
  multiplyTransform3D,
  type Transform3D,
} from '../../../../godot/math/transform3d.js';
import { nodePathLiteral } from '../../../../godot/variant/variantParser.js';
import { resolveNodePathLiteral } from '../../../../godot/string/nodePath.js';
import type { LiveLink, LiveTree } from '../../../../r3f/liveSceneTree.js';
import { liveGlobalTransform3D } from '../../../../r3f/liveGlobalTransform.js';
import { uniquePathsOfLiteral } from '../../../../r3f/nodePathUniqueNames.js';
import { liveNodePatches } from '../../../../r3f/liveNodePatches.js';
import { liveScenePassResults, type LiveScenePass } from '../../../../r3f/liveScenePass.js';
import type { NodePatch } from '../../../../r3f/nodePatch.js';
import { posedSkeletonOf } from '../../skeleton3d/skeletonBindings.js';
import type { AnimatedPose } from '../../skeleton3d/skeletonPose.js';
import type { BoneAttachment3DProperties } from './types.js';

/** Where a bound BoneAttachment3D stands, which its component takes for its own transform. */
export interface BoneAttachmentSeat {
  /** The live path of the Skeleton3D the attachment rides, which a clip's bone poses reach. */
  skeletonPath: string;
  /** The index of the bone the seat rides, as the file's bone_idx or `find_bone` resolved it. */
  bone: number;
  /** The global transform `on_skeleton_update` composes, with the seated ancestors in place. */
  global: Transform3D;
  /**
   * The local transform of the seat under `pose`, where null poses the file again. A parented
   * attachment takes the bone's global pose for its own (`bone_attachment_3d.cpp:311`); an
   * external one composes its skeleton's global under its parent's global (:305), which stands
   * where the seats before it put themselves.
   */
  localUnder(pose: AnimatedPose | null): Transform3D;
}

/**
 * The seat of every BoneAttachment3D of `tree` bound to a bone, by the attachment's live path. An
 * empty `external_skeleton` under a BoneAttachment3D parent takes the parent's external skeleton,
 * and a node that reaches no skeleton or no bone takes no seat: it keeps the transform the file
 * wrote, where Godot's `on_skeleton_update` leaves it too.
 */
export const seatBoneAttachments: LiveScenePass<BoneAttachmentSeat> = (tree) => {
  const seats = new Map<string, BoneAttachmentSeat>();
  // What each ancestor stands on, held as the property patches the transform walk reads: where a
  // RemoteTransform has moved a node, then each seat of this pass, parents first as the fold runs.
  const placed = new Map(liveScenePassResults(liveNodePatches, tree));
  tree.fold<void, void>(undefined, (link, _, descend) => {
    seatOf(link, tree, placed, seats);
    descend();
  });
  return seats;
};

/** Seats the BoneAttachment3D at `link`, or no seat where Godot binds nothing. */
function seatOf(
  link: LiveLink,
  tree: LiveTree,
  placed: Map<string, NodePatch>,
  seats: Map<string, BoneAttachmentSeat>
): void {
  const node = link.step.node;
  if (node.type !== 'BoneAttachment3D') return;
  const properties = node.properties as BoneAttachment3DProperties;
  // `override_pose` leaves the node at its authored transform and pushes that onto the bone
  // instead (`bone_attachment_3d.cpp:313-317`), where the push to the bone itself is another
  // slice's work, not this pass's.
  if (properties.overridePose) return;
  const skeleton = skeletonOf(properties, link.path, tree);
  if (!skeleton) return;
  const posed = posedSkeletonOf(skeleton, tree);
  // bone_idx at 0 or more wins; a negative one takes the first bone of the name, and a name no
  // bone carries leaves the node unbound (`_check_bind`, bone_attachment_3d.cpp:117-126).
  const bone = properties.boneIdx >= 0 ? properties.boneIdx : posed.findBone(properties.boneName);
  if (bone < 0) return;
  const pose = posed.globalPose(bone);

  if (!properties.useExternalSkeleton) {
    // `set_transform(bone_global_pose)` (:311): the pose is the local transform, and the parent
    // that carries it is the skeleton the seat came off.
    const parentGlobal = parentGlobalAt(tree, link.path, placed);
    placed.set(link.path, { transform: pose });
    seats.set(link.path, {
      skeletonPath: skeleton.path,
      bone,
      global: multiplyTransform3D(parentGlobal, pose),
      localUnder: (animated) => posed.globalPoseUnder(bone, animated),
    });
    return;
  }
  // `set_global_transform(skeleton_global * bone_global_pose)` (:305), read as a local under the
  // parent the scene puts the node in, seated ancestors in place.
  const skeletonGlobal = liveGlobalTransform3D(tree, skeleton.path, placed) ?? identityTransform3D();
  const global = multiplyTransform3D(skeletonGlobal, pose);
  const parentInverse = affineInverseTransform3D(parentGlobalAt(tree, link.path, placed));
  const local = multiplyTransform3D(parentInverse, global);
  placed.set(link.path, { transform: local });
  seats.set(link.path, {
    skeletonPath: skeleton.path,
    bone,
    global,
    localUnder: (animated) =>
      multiplyTransform3D(
        parentInverse,
        multiplyTransform3D(skeletonGlobal, posed.globalPoseUnder(bone, animated))
      ),
  });
}

/** The global transform of the node's parent, or the identity for a parentless one. */
function parentGlobalAt(tree: LiveTree, path: string, placed: ReadonlyMap<string, NodePatch>): Transform3D {
  const parentPath = parentPathOf(path);
  return (parentPath ? liveGlobalTransform3D(tree, parentPath, placed) : null) ?? identityTransform3D();
}

/**
 * The skeleton `get_skeleton` reaches (`bone_attachment_3d.cpp:128-142`): the parent while
 * `use_external_skeleton` is off, else the node `external_skeleton` names. An empty path takes the
 * nearest BoneAttachment3D ancestor's external skeleton instead, each empty one walking up
 * (`_update_external_skeleton_cache`, `:56-85`), and no Skeleton3D out of either is no skeleton.
 */
function skeletonOf(properties: BoneAttachment3DProperties, path: string, tree: LiveTree): LiveLink | null {
  if (!properties.useExternalSkeleton) {
    const parentPath = parentPathOf(path);
    const parent = parentPath ? tree.at(parentPath) : null;
    return parent?.step.node.type === 'Skeleton3D' ? parent : null;
  }
  if (pathTextOf(properties.externalSkeleton) !== '') {
    return skeletonAt(path, properties.externalSkeleton!, tree);
  }
  for (let parentPath = parentPathOf(path); parentPath; parentPath = parentPathOf(parentPath)) {
    const parent = tree.at(parentPath);
    if (parent?.step.node.type !== 'BoneAttachment3D') return null;
    const inherited = parent.step.node.properties as BoneAttachment3DProperties;
    if (pathTextOf(inherited.externalSkeleton) !== '') {
      return skeletonAt(parent.path, inherited.externalSkeleton!, tree);
    }
  }
  return null;
}

/** The Skeleton3D the `external_skeleton` literal names from the node at `from`, or null. */
function skeletonAt(from: string, literal: string, tree: LiveTree): LiveLink | null {
  const resolved = resolveNodePathLiteral(from, literal, uniquePathsOfLiteral(literal, from, tree));
  const skeleton = resolved === null ? null : tree.at(resolved);
  return skeleton?.step.node.type === 'Skeleton3D' ? skeleton : null;
}

/**
 * The path text an `external_skeleton` value stores: empty for an unset key and `NodePath("")`.
 */
function pathTextOf(literal: string | undefined): string {
  if (literal === undefined) return '';
  // A value of no known spelling stores its trimmed text, which the resolver reads as a path too.
  return nodePathLiteral(literal) ?? literal.trim();
}
