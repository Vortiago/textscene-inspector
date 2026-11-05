import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { MultiMeshInstance2D } from './Component';

nodeComponentRegistry.register({
  typeName: 'MultiMeshInstance2D',
  Component: MultiMeshInstance2D,
  canvasItem: true,
});
