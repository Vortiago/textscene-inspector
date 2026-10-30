/** SkeletonModifier3D is the base of every node that rewrites bone poses. The base makes no edit. */

import { registerSkeletonModifier } from '../shared/registerSkeletonModifier';
import { noPoseEdit } from '../../skeleton3d/poseModifier';

registerSkeletonModifier('SkeletonModifier3D', noPoseEdit);
