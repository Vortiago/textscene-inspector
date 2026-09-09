import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { TileMapLayer } from './Component';
import { TileGroupRenderer, describeYSortLayer } from './TileGroupRenderer';

nodeComponentRegistry.register({
  typeName: 'TileMapLayer',
  Component: TileMapLayer,
  canvasItem: true,
  // A y_sort_enabled layer is drawn per row by the y-sort pass rather than whole.
  ySortGroup: { describe: describeYSortLayer, Renderer: TileGroupRenderer },
});

export { TileMapLayer };
