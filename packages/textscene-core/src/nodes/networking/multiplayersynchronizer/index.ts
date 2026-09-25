/**
 * MultiplayerSynchronizer registration: parser.
 *
 * Reuses the Node parse. Property knowledge lives in linterParser.ts.
 * Draws nothing by design (ADR-0008), so index.r3f.ts registers Node
 * and its children still land in the right transform space.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNode } from '../../node/parser';

const multiplayerSynchronizerRegistration: NodeTypeRegistration = {
  typeName: 'MultiplayerSynchronizer',
  parser: parseNode,
};

nodeRegistry.register(multiplayerSynchronizerRegistration);

export { multiplayerSynchronizerRegistration };
