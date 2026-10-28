/**
 * The poses an AnimationPlayer writes to a Skeleton3D, by the live path of the skeleton (ADR-0016,
 * ADR-0017). The meshes bound to the skeleton listen and update their skin in place.
 */

import type { AnimatedPose } from '../../nodes/3d/skeleton3d/skeletonPose';
import { createPushStoreContext, type PushStore } from './pushStore';

export type AnimatedBonePoseRegistry = PushStore<AnimatedPose>;

const { Provider: AnimatedBonePosesProvider, useStore: useAnimatedBonePoses } =
  createPushStoreContext<AnimatedPose>('AnimatedBonePosesContext');

export { AnimatedBonePosesProvider, useAnimatedBonePoses };
