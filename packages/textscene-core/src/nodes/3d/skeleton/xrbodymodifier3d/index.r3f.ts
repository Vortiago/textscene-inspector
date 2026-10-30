/** XRBodyModifier3D is a modifier that writes tracked body poses. With no XR tracker it makes no edit. */

import { registerSkeletonModifier } from '../shared/registerSkeletonModifier';
import { noPoseEdit } from '../../skeleton3d/poseModifier';

registerSkeletonModifier('XRBodyModifier3D', noPoseEdit);
