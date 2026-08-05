/**
 * ItemList registration — parser.
 *
 * Reuses the Control parse; property knowledge lives in linterParser.ts.
 * Not rendered yet, so it registers NO component: the dispatcher falls back to
 * GenericNodeFallback and the tree keeps reporting it as not implemented.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseControl } from '../control/parser';

const itemListRegistration: NodeTypeRegistration = {
  typeName: 'ItemList',
  parser: parseControl,
};

nodeRegistry.register(itemListRegistration);

export { itemListRegistration };
