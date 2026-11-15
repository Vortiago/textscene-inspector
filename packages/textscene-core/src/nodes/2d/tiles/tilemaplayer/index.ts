/**
 * TileMapLayer registration: parser and property formatter.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { registerPaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';
import { tileMapLayerPaintRoom } from './paintRoom';
import { parseTileMapLayer } from './parser';
import { formatTileMapLayerProperties } from './propertyFormatter';

const tileMapLayerRegistration: NodeTypeRegistration = {
  typeName: 'TileMapLayer',
  parser: parseTileMapLayer,
  propertyFormatter: formatTileMapLayerProperties,
};

nodeRegistry.register(tileMapLayerRegistration);
registerPaintRoom('TileMapLayer', tileMapLayerPaintRoom);
