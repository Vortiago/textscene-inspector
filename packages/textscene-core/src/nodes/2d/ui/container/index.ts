/**
 * Container registration: the Control parser. It registers no node component,
 * so the dispatcher falls back to GenericNodeFallback.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseControl } from '../../../2d/ui/control/parser';

const containerRegistration: NodeTypeRegistration = {
  typeName: 'Container',
  parser: parseControl,
};

nodeRegistry.register(containerRegistration);

export { containerRegistration };
