/**
 * Skeleton3D registration: parser + property formatter. The parse reads the bone table and
 * `show_rest_only`, which the scene pass in `skeletonBindings.ts` poses to bind each MeshInstance3D
 * that names the skeleton. index.r3f.ts registers the transform-only component.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseSkeleton3D } from './parser';

const skeleton3DRegistration: NodeTypeRegistration = {
  typeName: 'Skeleton3D',
  parser: parseSkeleton3D,
};

nodeRegistry.register(skeleton3DRegistration);

export * from './parser';
export * from './types';
