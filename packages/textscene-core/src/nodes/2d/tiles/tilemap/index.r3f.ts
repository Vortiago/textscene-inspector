import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { TileMap } from './Component';

nodeComponentRegistry.register({ typeName: 'TileMap', Component: TileMap });

export { TileMap };
