/**
 * BaseButton registration: the parser. It reuses the Control parse, and property
 * knowledge lives in linterParser.ts.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseControl } from '../../../2d/ui/control/parser';

const baseButtonRegistration: NodeTypeRegistration = {
  typeName: 'BaseButton',
  parser: parseControl,
};

nodeRegistry.register(baseButtonRegistration);

export { baseButtonRegistration };
