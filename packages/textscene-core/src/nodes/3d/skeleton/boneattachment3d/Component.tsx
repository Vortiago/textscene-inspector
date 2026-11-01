/**
 * <BoneAttachment3D>: an invisible group that applies the seat its bone gives
 * (`bone_attachment_3d.cpp:294-322`), so its children ride the bone. The seat pass composes the
 * transform once per live path, and the poses a clip pushes on the skeleton move it in place.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { invisibleBase } from '../../../../r3f/invisibleBase';
import { useNodePath } from '../../../../r3f/contexts/NodePathContext';
import { useAnimatedBonePoses } from '../../../../r3f/contexts/AnimatedBonePosesContext';
import { useLiveScenePass } from '../../../../r3f/liveScenePass';
import { applyNodeTransform, decomposeForR3F, node3dGroupSpread } from '../../../../r3f/nodeTransform';
import { seatBoneAttachments } from './boneAttachmentSeats';
import type { AnimatedPose } from '../../skeleton3d/skeletonPose';
import type { BoneAttachment3DProperties } from './types';

/** The seat draws nothing of its own: the group holds its children's transform space. */
export const BoneAttachment3D = invisibleBase(function SeatedBoneAttachment({
  node,
  children,
}: NodeComponentProps) {
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
  const applyPose = useCallback(
    (pose: AnimatedPose | null) => {
      if (!seat || !group.current) return;
      applyNodeTransform(group.current, decomposeForR3F(seat.localUnder(pose)));
    },
    [seat]
  );
  // A new seat re-poses from the file first; each push holds its pose and applies it at once.
  useEffect(() => {
    held.current = null;
    if (!seat) return;
    return poses.subscribe(seat.skeletonPath, (pose) => {
      held.current = pose;
      applyPose(pose);
    });
  }, [seat, poses, applyPose]);
  // After a render's props, the held pose goes back on top of them.
  useEffect(() => {
    if (held.current !== null) applyPose(held.current);
  });

  return (
    <group ref={group} name={node.name} {...node3dGroupSpread(parts)}>
      {children}
    </group>
  );
});
