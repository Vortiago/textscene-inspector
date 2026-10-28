/** CopyTransformModifier3D is a modifier that copies the pose of a reference bone or node onto an apply bone. */

import { registerSkeletonModifier } from '../shared/registerSkeletonModifier';
import { readCopyTransformModifier } from './copyTransformModifier';

registerSkeletonModifier('CopyTransformModifier3D', readCopyTransformModifier);
