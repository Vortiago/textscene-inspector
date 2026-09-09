/**
 * ShapeCast2D registration — parser.
 *
 * Reuses the Node2D parse; property knowledge lives in linterParser.ts.
 * Draws nothing by design (ADR-0008), so index.r3f.ts registers Node2D
 * and its children still land in the right transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseNode2D } from '../../../base/node2d/parser';

const shapeCast2DRegistration: NodeTypeRegistration = {
  typeName: 'ShapeCast2D',
  parser: parseNode2D,
};

nodeRegistry.register(shapeCast2DRegistration);

export { shapeCast2DRegistration };
