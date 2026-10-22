/**
 * VisibleOnScreenNotifier3D registration: the parser. It reads `aabb` on top of the Node3D parse for
 * the gizmo, and property knowledge for the linter lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseVisibleOnScreenNotifier3D } from './parser';

const visibleOnScreenNotifier3DRegistration: NodeTypeRegistration = {
  typeName: 'VisibleOnScreenNotifier3D',
  parser: parseVisibleOnScreenNotifier3D,
};

nodeRegistry.register(visibleOnScreenNotifier3DRegistration);

export * from './parser';
export * from './types';
