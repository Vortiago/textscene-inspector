/** XRHandModifier3D is a modifier that writes tracked hand poses. With no XR tracker it makes no edit. */

import { registerSkeletonModifier } from '../shared/registerSkeletonModifier';
import { noPoseEdit } from '../../skeleton3d/poseModifier';

registerSkeletonModifier('XRHandModifier3D', noPoseEdit);
