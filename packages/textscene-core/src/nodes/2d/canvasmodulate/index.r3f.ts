import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { CanvasModulate } from './Component';

nodeComponentRegistry.register({ typeName: 'CanvasModulate', Component: CanvasModulate, canvasItem: true });

export { CanvasModulate };
