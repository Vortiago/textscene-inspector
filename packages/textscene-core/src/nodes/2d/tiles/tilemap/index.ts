/**
 * TileMap registration — parser + property formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTileMap } from './parser';
import { formatTileMapProperties } from './propertyFormatter';

const tileMapRegistration: NodeTypeRegistration = {
  typeName: 'TileMap',
  parser: parseTileMap,
  propertyFormatter: formatTileMapProperties,
};

nodeRegistry.register(tileMapRegistration);

export { tileMapRegistration };
