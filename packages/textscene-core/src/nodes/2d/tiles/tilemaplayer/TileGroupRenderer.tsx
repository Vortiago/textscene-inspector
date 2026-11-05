/**
 * Draws one row of a y-sorted TileMapLayer, an item of the parent's flat sort. A row is a child
 * canvas item of the layer (`tile_map_layer.cpp:341-357`), so it draws through `<CanvasItem2D>`
 * with the layer's transform, visibility, material, tint and z, at the sequence the sort gave it.
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../../../parser/types.js';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D.js';
import { drawableCells } from '../../../../resources/tileset/drawableCell.js';
import type { TileMapLayerProperties } from './types.js';
import { childCanvasItemProperties } from '../shared/childCanvasItem.js';
import { useTileSetModel } from '../../../../r3f/useTileSetModel.js';
import { TileQuadrants } from '../../../../r3f/TileQuadrants.js';
import { ySortItemId, type YSortItem } from '../../../../r3f/ySortItems.js';
import type { YSortGroupDescription } from '../../../../r3f/NodeComponentRegistry.js';
import { useNodePath } from '../../../../r3f/contexts/NodePathContext.js';
import { useLiveDrawnNode } from '../../../../r3f/liveNodePatches.js';
import { useIsHiddenInEditor } from '../../../../r3f/canvasItemVisible.js';

export function TileGroupRenderer({ item, node: authored }: { item: YSortItem; node: TscnNode }): ReactNode {
  const path = useNodePath();
  const node = useLiveDrawnNode(authored, path);
  const props = node.properties as TileMapLayerProperties;
  const { model, status } = useTileSetModel(props.tile_set);
  // The y-sort pass gives the row's drawable cells. An item the pass left whole, because its
  // TileSet had not arrived there, draws every cell of the layer.
  const layerCells = props.cells;
  const cells = useMemo(
    () => item.tileData?.cells ?? (model && layerCells ? drawableCells(model, layerCells) : null),
    [item.tileData?.cells, model, layerCells]
  );
  // The row is one rendering quadrant (`tile_map_layer.cpp:546-548`). Memoised, so the row's
  // batches keep their geometry across a re-render of the sorted list.
  const quadrants = useMemo(() => (cells ? [cells] : []), [cells]);
  // The layer's children are items of the flat sort, so the row holds none. It is named for the
  // row, since every row of the layer draws a group of its own.
  const row = useMemo(
    () => ({ ...node, name: `TileGroup_${node.name}_${ySortItemId(item)}`, children: [] }),
    [node, item]
  );
  // `<CanvasItem2D>` applies `visible`. The dispatcher's eye toggle never wraps a row, so the
  // row reads it here.
  const isHidden = useIsHiddenInEditor(path ?? '');
  const drawable = !isHidden && props.enabled && !!cells?.length && status === 'loaded';

  return (
    <CanvasItem2D
      node={row}
      props={props}
      ownItems={(state) =>
        drawable &&
        model && (
          <TileQuadrants
            quadrants={quadrants}
            model={model}
            selfTint={state.tint.self}
            material={state.material}
            lightMask={state.lightMask}
            zFinal={state.zFinal}
            name={node.name}
            sampler={state.sampler}
          />
        )
      }
    />
  );
}

/** What the y-sort pass needs to know about this layer to decompose it per row. */
/** The layer as its own rows draw it: below the group the layer's component placed. */
export function asRootRowsNode(node: TscnNode): TscnNode {
  return { ...node, properties: childCanvasItemProperties(node.properties as TileMapLayerProperties) };
}

export function describeYSortLayer(node: TscnNode): YSortGroupDescription {
  const props = node.properties as TileMapLayerProperties;
  return {
    tileSetRef: props.tile_set ?? '',
    ySortOrigin: props.y_sort_origin,
    cells: props.cells ?? null,
  };
}
