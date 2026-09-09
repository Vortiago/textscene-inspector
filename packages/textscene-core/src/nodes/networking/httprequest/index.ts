/**
 * HTTPRequest registration — parser.
 *
 * Reuses the Node parse; property knowledge lives in linterParser.ts.
 * Draws nothing by design (ADR-0008), so index.r3f.ts registers Node
 * and its children still land in the right transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const hTTPRequestRegistration: NodeTypeRegistration = {
  typeName: 'HTTPRequest',
  parser: parseNode,
};

nodeRegistry.register(hTTPRequestRegistration);

export { hTTPRequestRegistration };
