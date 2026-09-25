/** Registers the PanelContainer parser. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parsePanelContainer } from './parser';

const panelContainerRegistration: NodeTypeRegistration = {
  typeName: 'PanelContainer',
  parser: parsePanelContainer,
};

nodeRegistry.register(panelContainerRegistration);

export { panelContainerRegistration };
export * from './parser';
