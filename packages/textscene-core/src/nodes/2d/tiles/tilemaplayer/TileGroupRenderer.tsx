/**
 * Draws a y-sorted TileMapLayer's rows, which are items of the parent's flat
 * sort. This path bypasses `<TileMapLayer>` and `<CanvasItem2D>`, so it repeats
 * their material resolution, canvas tint, light cull and visibility itself.
 */

import { useMemo, type ReactNode } from 'react';
import type { TscnNode } from '../../../../parser/types.js';
import { useCanvasItemTint } from '../../../../r3f/canvasItemModulate.js';
import { useCanvasItemMaterial } from '../../../../r3f/components/canvasItemMaterialContext.js';
import { useCanvasModulateFor } from '../../../../r3f/canvasModulate.js';
import { useCanvasItemLighting } from '../../../../r3f/lighting2d/useCanvasItemLighting.js';
import { canvasItemBlendState } from '../../../../resources/materials/canvasitemmaterial/renderer.js';
import { CanvasItemBlendMode } from '../../../../resources/materials/canvasitemmaterial/types.js';
import { drawnSources } from '../../../../r3f/drawnSources.js';
import { canvasRenderOrder } from '../../../../r3f/canvasPaintOrder.js';
import { accumulateCanvasItemZ, useEffectiveZ } from '../../../../r3f/lighting2d/canvasItemPlacement.js';
import type { TileMapLayerProperties } from './types.js';
import { useTileSetModel } from '../../../../r3f/useTileSetModel.js';
import { TileSourceMesh } from '../../../../r3f/TileSourceMesh.js';
import { ySortItemId, type YSortItem } from '../../../../r3f/ySortItems.js';
import type { YSortGroupDescription } from '../../../../r3f/NodeComponentRegistry.js';

export function TileGroupRenderer({ item, layerRank, sequence, node }: {
  item: YSortItem;
  /** The canvas this row draws on, as a rank (`canvasPaintOrder.ts`). */
  layerRank: number;
  /**
   * The Y-group's draw sequence, composed into the key here: `z_final` is correct
   * only inside `<LiftedAncestors>`, which provides `EffectiveZ`. The group holds
   * the key. Each atlas batch's `renderOrder` orders it within that key, a batching
   * artefact, since Godot interleaves a layer's cells in scan order.
   */
  sequence: number;
  node: TscnNode;
}): ReactNode | null {
  const tileProps = node.properties as TileMapLayerProperties;
  const zFinal = accumulateCanvasItemZ(useEffectiveZ(), tileProps);
  const renderOrder = canvasRenderOrder({ layerRank, zFinal, sequence });
  const { model, status } = useTileSetModel(tileProps.tile_set);
  // The same material and `useCanvasItemTint` the component body receives, so a
  // CanvasModulate reaches y-sorted tiles too.
  const material = useCanvasItemMaterial(tileProps);
  const canvasModulate = useCanvasModulateFor(material);
  const { color, opacity } = useCanvasItemTint(tileProps, canvasModulate);
  // Lights cull against `zFinal`, not `item.effectiveZ`: `YSortContext` has no
  // provider, so `item.effectiveZ` always starts at 0 and drops every `z_index` at or
  // above the y-sort root.
  const lighting = useCanvasItemLighting(material, tileProps.light_mask, zFinal);
  const allCells = tileProps.cells ?? null;
  // When expanded by the y-sort pass, tileData.cells holds the filtered Y-group cells.
  const cells = item.tileData?.cells ?? allCells;
  // The ordinary path gates `visible` in <CanvasItem2D> and `enabled` in the body.
  // This path bypasses both, so it gates them here.
  const drawable =
    tileProps.visible !== false && tileProps.enabled && !!cells?.length && status === 'loaded';

  // One renderer mounts per tile row, so the partition is memoised: without it every
  // row re-buckets its cells on every render of the sorted list. A hidden layer still
  // mounts a renderer per row, so `drawable` gates the partition too.
  const cellsBySource = useMemo(
    () => (drawable && model && cells?.length ? drawnSources(model, cells) : null),
    [drawable, model, cells]
  );

  // The layer's own Node2D offset, which <CanvasItem2D> applies on the ordinary path.
  // The rows' sort keys already include `position.y`, so the draw must too.
  // Godot's +Y is down, hence the negation.
  const originX = tileProps.position?.x ?? 0;
  const originY = -(tileProps.position?.y ?? 0);

  if (!drawable || !model || !cellsBySource) {
    return (
      <group
        name={`TileGroup_${node.name}_${ySortItemId(item)}`}
        position={[originX, originY, 0]}
        renderOrder={renderOrder}
      />
    );
  }

  return (
    <group
      name={`TileGroup_${node.name}_${ySortItemId(item)}`}
      position={[originX, originY, 0]}
      renderOrder={renderOrder}
    >
      {cellsBySource.map(({ sourceId, sourceIndex, source, cells: sourceCells }) => (
        <TileSourceMesh
          key={`${sourceId}_${ySortItemId(item)}`}
          source={source}
          cells={sourceCells}
          grid={model}
          renderOrder={sourceIndex}
          color={color}
          opacity={opacity}
          name={node.name}
          blend={canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX)}
          lighting={lighting}
        />
      ))}
    </group>
  );
}

/** What the y-sort pass needs to know about this layer to decompose it per row. */
export function describeYSortLayer(node: TscnNode): YSortGroupDescription {
  const props = node.properties as TileMapLayerProperties;
  return {
    tileSetRef: props.tile_set ?? '',
    positionY: props.position?.y ?? 0,
    ySortOrigin: (props.y_sort_origin as number) ?? 0,
    cells: props.cells ?? null,
  };
}
