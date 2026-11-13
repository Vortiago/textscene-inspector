import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { MeshInstance2D } from './Component';

nodeComponentRegistry.register({ typeName: 'MeshInstance2D', Component: MeshInstance2D, canvasItem: true });
