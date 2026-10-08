/**
 * Draws a y-sorted TileMapLayer's rows, which are items of the parent's flat
 * sort. This path bypasses `<TileMapLayer>` and `<CanvasItem2D>`, so it repeats
 * their material resolution, canvas tint, light cull and visibility itself.
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../../../parser/types.js';
import { useCanvasItemTint } from '../../../../r3f/canvasItemModulate.js';
import { useCanvasItemMaterial } from '../../../../r3f/components/canvasItemMaterialContext.js';
import { canvasRenderOrder } from '../../../../r3f/canvasPaintOrder.js';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup.js';
import { drawableCells } from '../../../../resources/tileset/drawableCell.js';
import { accumulateCanvasItemZ, useEffectiveZ } from '../../../../r3f/lighting2d/canvasItemPlacement.js';
import type { TileMapLayerProperties } from './types.js';
import { useTileSetModel } from '../../../../r3f/useTileSetModel.js';
import { TileQuadrants } from '../../../../r3f/TileQuadrants.js';
import { ySortItemId, type YSortItem } from '../../../../r3f/ySortItems.js';
import type { YSortGroupDescription } from '../../../../r3f/NodeComponentRegistry.js';

export function TileGroupRenderer({
  item,
  layerRank,
  sequence,
  node,
}: {
  item: YSortItem;
  /** The canvas this row draws on, as a rank (`canvasPaintOrder.ts`). */
  layerRank: number;
  /**
   * The Y-group's draw sequence, composed into the key here: `z_final` is correct
   * only inside `<LiftedAncestors>`, which provides `EffectiveZ`. The group holds
   * the key. Each source run's `renderOrder` orders it within that key.
   */
  sequence: number;
  node: TscnNode;
}): ReactNode | null {
  const tileProps = node.properties as TileMapLayerProperties;
  const zFinal = accumulateCanvasItemZ(useEffectiveZ(), tileProps);
  const renderOrder = canvasRenderOrder({ layerRank, zFinal, sequence });
  const { model, status } = useTileSetModel(tileProps.tile_set);
  // The same material and tint the component body receives. Each tile item applies the canvas
  // tint its own material admits.
  const material = useCanvasItemMaterial(tileProps);
  const tint = useCanvasItemTint(tileProps);
  // When expanded by the y-sort pass, tileData.cells holds the row's drawable cells. An item the
  // pass left whole, because its TileSet had not arrived there, draws every cell of the layer.
  const layerCells = tileProps.cells;
  const cells = useMemo(
    () => item.tileData?.cells ?? (model && layerCells ? drawableCells(model, layerCells) : null),
    [item.tileData?.cells, model, layerCells]
  );
  // The ordinary path gates `visible` in <CanvasItem2D> and `enabled` in the body.
  // This path bypasses both, so it gates them here.
  const drawable = tileProps.visible !== false && tileProps.enabled && !!cells?.length && status === 'loaded';
  // The row is one rendering quadrant (`tile_map_layer.cpp:546-548`). Memoised, so the row's
  // batches keep their geometry across a re-render of the sorted list.
  const quadrants = useMemo(() => (cells ? [cells] : []), [cells]);

  // The layer's own Node2D offset, which <CanvasItem2D> applies on the ordinary path.
  // The rows' sort keys already include `position.y`, so the draw must too.
  // Godot's +Y is down, hence the negation.
  const originX = tileProps.position?.x ?? 0;
  const originY = -(tileProps.position?.y ?? 0);

  return (
    <CanvasItemGroup
      name={`TileGroup_${node.name}_${ySortItemId(item)}`}
      position={[originX, originY, 0]}
      renderOrder={renderOrder}
    >
      {drawable && model && cells && (
        // Lights cull against `zFinal`, not `item.effectiveZ`: `YSortContext` has no provider, so
        // `item.effectiveZ` always starts at 0 and drops every `z_index` at or above the y-sort root.
        <TileQuadrants
          quadrants={quadrants}
          model={model}
          selfTint={tint.self}
          material={material}
          lightMask={tileProps.light_mask}
          zFinal={zFinal}
          name={node.name}
        />
      )}
    </CanvasItemGroup>
  );
}

/** What the y-sort pass needs to know about this layer to decompose it per row. */
export function describeYSortLayer(node: TscnNode): YSortGroupDescription {
  const props = node.properties as TileMapLayerProperties;
  return {
    tileSetRef: props.tile_set ?? '',
    positionY: props.position?.y ?? 0,
    ySortOrigin: props.y_sort_origin,
    cells: props.cells ?? null,
  };
}
