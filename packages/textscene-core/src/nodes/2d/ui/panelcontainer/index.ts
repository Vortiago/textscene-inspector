/** PanelContainer registration — parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parsePanelContainer, isPanelContainer } from './parser';

const panelContainerRegistration: NodeTypeRegistration = {
  typeName: 'PanelContainer',
  typeGuard: isPanelContainer,
  parser: parsePanelContainer,
};

nodeRegistry.register(panelContainerRegistration);

export { panelContainerRegistration };
export * from './parser';
