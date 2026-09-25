/**
 * ShapeCast3D registration: the parser.
 *
 * It reuses the Node3D parse, and property knowledge lives in linterParser.ts. It
 * draws nothing by design (ADR-0008), so index.r3f.ts registers Node3D and its children
 * still land in the right transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode3D } from '../../../base/node3d/parser';

const shapeCast3DRegistration: NodeTypeRegistration = {
  typeName: 'ShapeCast3D',
  parser: parseNode3D,
};

nodeRegistry.register(shapeCast3DRegistration);

export { shapeCast3DRegistration };
