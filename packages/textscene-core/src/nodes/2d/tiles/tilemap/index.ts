/**
 * TileMap registration — parser.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseTileMap } from './parser';

const tileMapRegistration: NodeTypeRegistration = {
  typeName: 'TileMap',
  parser: parseTileMap,
};

nodeRegistry.register(tileMapRegistration);

export { tileMapRegistration };
