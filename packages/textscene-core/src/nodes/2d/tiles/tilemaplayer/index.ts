/**
 * TileMapLayer registration — parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTileMapLayer } from './parser';

const tileMapLayerRegistration: NodeTypeRegistration = {
  typeName: 'TileMapLayer',
  parser: parseTileMapLayer,
};

nodeRegistry.register(tileMapLayerRegistration);

export { tileMapLayerRegistration };
