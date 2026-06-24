import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Path2D } from './Component';

nodeComponentRegistry.register({ typeName: 'Path2D', Component: Path2D, canvasItem: true });

export { Path2D };
