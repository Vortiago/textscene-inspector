/**
 * Applies an instancing scene's override of a Skeleton3D or BoneAttachment3D to the group that
 * stands for it (`frameGroups.ts`). The group takes `visible`, and a Skeleton3D's `transform`.
 * Godot sets a BoneAttachment3D's transform from its bone (`bone_attachment_3d.cpp:311`), so that
 * one has no effect. The properties that pose bones or move an attachment to another bone are not
 * read yet, and the override warns for each.
 */
import type * as THREE from 'three';
import type { TscnNode } from '../../../parser/types';
import type { Node3DProperties } from '../../../nodes/base/node3d/types';
import { godotNodePaths } from '../../../resources/formats/glb/godotNodes';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import { decomposeForR3F } from '../../nodeTransform';
import type { GlbObjectEntry } from './glbHierarchy';
import { writeNodeTransform } from './glbNodeTransform';
import { relativeTo } from '../../../utils/nodePath';
import { warnOnce } from '../../../utils/warnOnce';
import { glbFrames, type GlbFrame } from './glbPathLookup';

/** The drive properties of each frame kind, which change the drawing. A key ending in `/` is a prefix. */
const UNREAD_PROPERTIES: Readonly<Record<GlbFrame['kind'], readonly string[]>> = {
  skeleton: ['show_rest_only', 'motion_scale', 'bones/'],
  boneAttachment: ['bone_name', 'bone_idx', 'override_pose', 'use_external_skeleton', 'external_skeleton'],
};

/**
 * Writes the properties of `override` on `frame`, and warns for the ones nothing reads. Returns
 * whether it wrote a transform.
 */
export function applyGlbFrameOverride(
  entries: readonly GlbObjectEntry[],
  frame: GlbFrame,
  override: TscnNode
): boolean {
  warnUnreadProperties(entries, frame, override);
  if (boolSlotValue(override.rawProperties.visible) === false) {
    for (const object of objectsBelowFrame(entries, frame)) object.visible = false;
  }
  const transform = (override.properties as Node3DProperties).transform;
  if (!transform) return false;
  if (frame.kind === 'boneAttachment') {
    warnOnce(
      entries,
      `${frame.path}\0transform`,
      `[glbFrameOverrides] "${frame.path}" sets transform, which Godot replaces with the pose of its bone (bone_attachment_3d.cpp:311): it is ignored`
    );
    return false;
  }
  // A Skeleton3D with no root bone in this GLB has no group to move.
  if (!frame.group) return false;
  writeNodeTransform(frame.group, decomposeForR3F(transform));
  return true;
}

/**
 * What hiding `frame` hides: its group, which holds the root bones or what hangs on the bone, and
 * every object that stands for a node below it, such as a skinned mesh the group does not hold.
 */
function objectsBelowFrame(entries: readonly GlbObjectEntry[], frame: GlbFrame): THREE.Object3D[] {
  const nodes = entries
    .filter(({ object }) => godotNodePaths(object).some((path) => relativeTo(frame.path, path) !== undefined))
    .map(({ object }) => object);
  return frame.group ? [frame.group, ...nodes] : nodes;
}

/** A frame of the GLB with the objects its `visible` governs, as {@link objectsBelowFrame} lists them. */
export interface FrameMembers {
  frame: GlbFrame;
  below: readonly THREE.Object3D[];
}

/**
 * Each Skeleton3D and BoneAttachment3D of the GLB with the objects below it. The GLB root hides
 * them in turn, since a frame's `visible` and the `visible` of a node below it both apply.
 *
 * @oneWay The Skeleton3D and BoneAttachment3D groups of an instanced GLB, with what each hides
 */
export function frameMembers(entries: readonly GlbObjectEntry[]): FrameMembers[] {
  return glbFrames(entries).map((frame) => ({ frame, below: objectsBelowFrame(entries, frame) }));
}

function warnUnreadProperties(entries: readonly GlbObjectEntry[], frame: GlbFrame, override: TscnNode): void {
  for (const key of Object.keys(override.rawProperties)) {
    if (
      !UNREAD_PROPERTIES[frame.kind].some((name) =>
        name.endsWith('/') ? key.startsWith(name) : key === name
      )
    ) {
      continue;
    }
    warnOnce(
      entries,
      `${frame.path}\0${key}`,
      `[glbFrameOverrides] "${frame.path}" sets ${key}, which the previewer does not drive yet (#980): it is ignored`
    );
  }
}
