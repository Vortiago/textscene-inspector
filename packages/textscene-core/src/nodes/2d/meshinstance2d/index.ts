/**
 * MeshInstance2D registration — parser.
 *
 * Reuses the Node2D parse; property knowledge lives in linterParser.ts.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode2D } from '../../base/node2d/parser';

const meshInstance2DRegistration: NodeTypeRegistration = {
  typeName: 'MeshInstance2D',
  parser: parseNode2D,
};

nodeRegistry.register(meshInstance2DRegistration);

export { meshInstance2DRegistration };
