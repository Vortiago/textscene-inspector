/**
 * Gives each Skeleton3D and BoneAttachment3D an object: a group below the object it follows, holding
 * what Godot puts below the node. Godot's node has a transform, a visibility and children, and three
 * has no object for it. The group is the identity until a scene writes to the node, and the walk of
 * the GLB's objects looks through it (`flattenGlbObjects`), so every path stays what it was.
 */

import * as THREE from 'three';
import {
  godotFrames,
  godotSkeletonOfBone,
  isUnderGodotSkeleton,
  markFrameGroup,
  type GodotFrame,
} from './godotNodes';

/** Call once on a loaded glTF, after `tagGodotNodes`. */
export function groupFrames(root: THREE.Object3D): void {
  const frames: { host: THREE.Object3D; frame: GodotFrame }[] = [];
  root.traverse((host) => {
    for (const frame of godotFrames(host)) frames.push({ host, frame });
  });
  for (const { host, frame } of frames) {
    const members = host.children.filter((child) => belongsTo(child, frame));
    if (members.length > 0) groupAt(host, frame.path, members);
  }
}

/**
 * Whether Godot puts `child`, a child object of the frame's host, below the frame. A Skeleton3D
 * holds its root bones, and a BoneAttachment3D holds what hangs on its bone: no bone, and no skinned
 * mesh, which Godot moves to the Skeleton3D.
 */
function belongsTo(child: THREE.Object3D, { path, kind }: GodotFrame): boolean {
  const skeleton = godotSkeletonOfBone(child);
  return kind === 'skeleton' ? skeleton === path : skeleton === undefined && !isUnderGodotSkeleton(child);
}

function groupAt(host: THREE.Object3D, framePath: string, members: THREE.Object3D[]): void {
  const group = new THREE.Group();
  markFrameGroup(group, framePath);
  const place = host.children.indexOf(members[0]!);
  group.add(...members);
  // `add` would append. The group takes the first member's place, so the tree order holds.
  host.children.splice(place, 0, group);
  group.parent = host;
}
