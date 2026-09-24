/** ItemList registration: parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseItemList } from './parser';

const itemListRegistration: NodeTypeRegistration = {
  typeName: 'ItemList',
  parser: parseItemList,
};

nodeRegistry.register(itemListRegistration);

export { itemListRegistration };
export * from './parser';
export * from './types';
