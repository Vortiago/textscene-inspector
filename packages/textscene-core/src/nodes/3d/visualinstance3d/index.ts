/**
 * VisualInstance3D registration: the parser. The node renders as a transform-only group (ADR-0008). Its
 * parser reads `layers` on top of the Node3D fields, and index.r3f.ts reuses the Node3D component.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseVisualInstance3D } from './parser';

const visualInstance3DRegistration: NodeTypeRegistration = {
  typeName: 'VisualInstance3D',
  parser: parseVisualInstance3D,
};

nodeRegistry.register(visualInstance3DRegistration);

export { visualInstance3DRegistration };
