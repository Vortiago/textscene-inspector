/**
 * The component registration every SkeletonModifier3D type shares: it draws nothing of its own, and
 * joins the Skeleton3D pass, which runs the pose edit its reader makes.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';
import type { PoseModifierReader } from '../../skeleton3d/poseModifier';

export function registerSkeletonModifier(typeName: string, poseModifier: PoseModifierReader): void {
  nodeComponentRegistry.register({
    typeName,
    Component: Node3D,
    renderIntent: 'transform-only',
    scenePass: { stage: 'live' },
    poseModifier,
  });
}
