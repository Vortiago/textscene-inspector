/**
 * <BoneAttachment3D>: an invisible group that applies the seat its bone gives
 * (`bone_attachment_3d.cpp:294-322`), so its children ride the bone. The seat pass composes the
 * transform once per live path, and the poses a clip pushes on the skeleton move it in place.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { invisibleBase } from '../../../../r3f/invisibleBase';
import { useNodePath } from '../../../../r3f/contexts/NodePathContext';
import { useAnimatedBonePoses } from '../../../../r3f/contexts/AnimatedBonePosesContext';
import { useLiveScenePass } from '../../../../r3f/liveScenePass';
import {
  decomposeForR3F,
  node3dGroupSpread,
  PLAIN_UPDATE_MATRIX,
  type NodeTransform,
} from '../../../../r3f/nodeTransform';
import { seatBoneAttachments } from './boneAttachmentSeats';
import type { AnimatedPose } from '../../skeleton3d/skeletonPose';
import type { BoneAttachment3DProperties } from './types';

/** Sets the object's transform parts, whatever `nodeTransform` composed them for. */
function applyParts(object: THREE.Object3D, parts: NodeTransform): void {
  object.position.set(parts.position[0]!, parts.position[1]!, parts.position[2]!);
  object.rotation.set(parts.rotation[0]!, parts.rotation[1]!, parts.rotation[2]!);
  object.scale.set(parts.scale[0]!, parts.scale[1]!, parts.scale[2]!);
  object.updateMatrix = parts.updateMatrix ?? PLAIN_UPDATE_MATRIX;
}

function SeatedBoneAttachment({ node, children }: NodeComponentProps) {
  const properties = node.properties as BoneAttachment3DProperties;
  const nodePath = useNodePath();
  const seat = useLiveScenePass(seatBoneAttachments, nodePath);
  // The seat in the pose of the file, which stands whenever no clip pushes on the skeleton; an
  // unbound node takes the authored transform it would keep in Godot.
  const parts = useMemo(
    () => decomposeForR3F(seat ? seat.localUnder(null) : properties.transform),
    [seat, properties]
  );

  const poses = useAnimatedBonePoses();
  const group = useRef<THREE.Group>(null);
  // The pose the seat follows, held for a re-render: React applies the file-pose props again, and
  // a clip that stands still (a paused seek) pushes nothing after that to bring the seat back.
  const held = useRef<AnimatedPose | null>(null);
  const applyPose = useCallback(() => {
    if (!seat || !group.current) return;
    applyParts(group.current, decomposeForR3F(seat.localUnder(held.current)));
  }, [seat]);
  // A new seat re-poses from the file first; each push holds its pose and applies it at once.
  useEffect(() => {
    held.current = null;
    if (!seat) return;
    return poses.subscribe(seat.skeletonPath, (pose) => {
      held.current = pose;
      applyPose();
    });
  }, [seat, poses, applyPose]);
  // After a render's props, the held pose goes back on top of them.
  useEffect(() => {
    if (held.current !== null) applyPose();
  });

  return (
    <group ref={group} name={node.name} {...node3dGroupSpread(parts)}>
      {children}
    </group>
  );
}

/** The seat draws nothing of its own: the group holds its children's transform space. */
export const BoneAttachment3D = invisibleBase(function UndrawnBoneAttachment({
  node,
  children,
}: NodeComponentProps) {
  return <SeatedBoneAttachment node={node}>{children}</SeatedBoneAttachment>;
});
