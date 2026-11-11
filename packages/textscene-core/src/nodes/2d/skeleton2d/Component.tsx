/**
 * <Skeleton2D> positions its children as a Node2D does, and owns the pose of its bones: each render
 * it runs its modification stack on the drawn Bone2Ds, and hands the bone matrices to each
 * Polygon2D it skins (`skeleton_2d.cpp:592-603`, `:769-815`).
 */

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useOptionalSelection } from '../../../r3f/contexts/SelectionContext';
import { useLiveScenePass } from '../../../r3f/liveScenePass';
import { observeScenePose } from '../../../r3f/sceneRenderCamera';
import { Node2D } from '../../base/node2d/Component';
import { Skeleton2DPose, type BoundStack } from './skeletonPose';
import { mountSkeleton2DPose } from './skeletonPoses';
import { bindSkeleton2DRigs } from './skeletonRig';
import type { Skeleton2DProperties } from './types';
import { useBoundStack } from './useBoundStack';

/**
 * Keeps the pose of the skeleton at `path` while it is mounted. Without the registry of node
 * objects, which an AnimationPlayer binds through too, the skeleton has no pose.
 */
function useSkeleton2DPose(path: string | null, bound: BoundStack | null): void {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const registry = useOptionalSelection()?.nodeObjectMap ?? null;
  const rig = useLiveScenePass(bindSkeleton2DRigs, path);
  useEffect(() => {
    if (path === null || !rig || !registry) return;
    const pose = new Skeleton2DPose(rig, path, registry, bound);
    const stops = [mountSkeleton2DPose(registry, path, pose), observeScenePose(scene, pose)];
    // A stack that loads after the first frame moves the bones with no other change to draw.
    invalidate();
    return () => {
      stops.forEach((stop) => stop());
      pose.restore();
    };
  }, [scene, invalidate, registry, path, rig, bound]);
}

export function Skeleton2D({ node, children }: NodeComponentProps) {
  const props = node.properties as Skeleton2DProperties;
  const path = useNodePath();
  useSkeleton2DPose(path, useBoundStack(props.modificationStack, path));
  return <Node2D node={node}>{children}</Node2D>;
}
