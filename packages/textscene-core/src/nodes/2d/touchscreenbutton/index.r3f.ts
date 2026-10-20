import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { TouchScreenButton } from './Component';

nodeComponentRegistry.register({
  typeName: 'TouchScreenButton',
  Component: TouchScreenButton,
  canvasItem: true,
});
