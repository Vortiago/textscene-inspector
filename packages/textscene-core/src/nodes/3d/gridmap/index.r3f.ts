import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { GridMap } from './Component';

nodeComponentRegistry.register({ typeName: 'GridMap', Component: GridMap });

export { GridMap };
