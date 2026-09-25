/** Registers the Control parser for Range. `index.r3f.ts` registers its painter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseControl } from '../../../2d/ui/control/parser';

const rangeRegistration: NodeTypeRegistration = {
  typeName: 'Range',
  parser: parseControl,
};

nodeRegistry.register(rangeRegistration);

export { rangeRegistration };
