/** BoneConstraint3D is the base of the bone constraints. The base makes no edit. */

import { registerSkeletonModifier } from '../shared/registerSkeletonModifier';
import { noPoseEdit } from '../../skeleton3d/poseModifier';

registerSkeletonModifier('BoneConstraint3D', noPoseEdit);
