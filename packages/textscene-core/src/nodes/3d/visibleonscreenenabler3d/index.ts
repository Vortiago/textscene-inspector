/**
 * VisibleOnScreenEnabler3D registration: the parser. It reuses the notifier's parse, which reads
 * `aabb` for the gizmo, and property knowledge lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseVisibleOnScreenNotifier3D } from '../visibleonscreennotifier3d/parser';

const visibleOnScreenEnabler3DRegistration: NodeTypeRegistration = {
  typeName: 'VisibleOnScreenEnabler3D',
  parser: parseVisibleOnScreenNotifier3D,
};

nodeRegistry.register(visibleOnScreenEnabler3DRegistration);
