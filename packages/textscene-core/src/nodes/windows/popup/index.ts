/**
 * Popup registration — parser.
 *
 * Reuses the Node parse; property knowledge lives in linterParser.ts.
 * Not rendered yet: index.r3f.ts registers Node under `renderIntent: 'pending'`,
 * so the tree reports a gap and the group carries the placeholder marker. The
 * `Node` base applies no `visible`, and an unregistered type already sat in both
 * canvases, so unlike the Node2D/Node3D-based pending slices this registration
 * buys the declared gap alone.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const popupRegistration: NodeTypeRegistration = {
  typeName: 'Popup',
  parser: parseNode,
};

nodeRegistry.register(popupRegistration);

export { popupRegistration };
