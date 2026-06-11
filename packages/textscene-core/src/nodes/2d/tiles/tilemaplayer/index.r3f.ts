import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { TileMapLayer } from './Component';

nodeComponentRegistry.register({ typeName: 'TileMapLayer', Component: TileMapLayer });

export { TileMapLayer };
