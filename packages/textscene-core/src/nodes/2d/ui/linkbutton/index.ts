/** Registers the LinkButton parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseLinkButton } from './parser';

const linkButtonRegistration: NodeTypeRegistration = {
  typeName: 'LinkButton',
  parser: parseLinkButton,
};

nodeRegistry.register(linkButtonRegistration);

export { linkButtonRegistration };
