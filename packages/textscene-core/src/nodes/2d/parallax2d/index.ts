/**
 * Parallax2D registration — parser.
 *
 * Reuses the Node2D parse; property knowledge lives in linterParser.ts.
 * Not rendered yet: index.r3f.ts registers Node2D under `renderIntent: 'pending'`,
 * so the tree still reports a gap while `visible` and the workspace split work.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const parallax2DRegistration: NodeTypeRegistration = {
  typeName: 'Parallax2D',
  parser: parseNode2D,
};

nodeRegistry.register(parallax2DRegistration);

export { parallax2DRegistration };
