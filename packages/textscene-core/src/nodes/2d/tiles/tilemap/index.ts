/** Registers the TileMap parser and property formatter. */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { registerPaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';
import { tileMapPaintRoom } from './paintRoom';
import { parseTileMap } from './parser';
import { formatTileMapProperties } from './propertyFormatter';

const tileMapRegistration: NodeTypeRegistration = {
  typeName: 'TileMap',
  parser: parseTileMap,
  propertyFormatter: formatTileMapProperties,
};

nodeRegistry.register(tileMapRegistration);
registerPaintRoom('TileMap', tileMapPaintRoom);
