/**
 * A y-sorted TileMapLayer's rows are items of the parent's flat sort, so they
 * are drawn here rather than through `<TileMapLayer>`. That bypasses
 * `<CanvasItem2D>` and the component body alike, which is why this file
 * reproduces their rituals — material resolution, canvas tint, light cull,
 * visibility — instead of inheriting them.
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
   * The Y-group's draw sequence. Composed into the full key HERE rather than by
   * the caller, because the third term — `z_final` — is only correct inside
   * `<LiftedAncestors>`: that is what provides the accumulated `EffectiveZ`,
   * while `item.effectiveZ` is accumulated from `YSortContext`, which has no
   * provider anywhere and so always starts at 0. Keying off the latter dropped
   * every `z_index` at or above the y-sort root, splitting a node against
   * itself — its own body in the real bucket, its tile rows in bucket 0.
   *
   * The key rides the GROUP so all of this row's atlas batches share it; their
   * own `renderOrder` then orders them WITHIN it, a batching artifact rather
   * than a draw position (Godot interleaves a layer's cells in scan order).
   */
  sequence: number;
  node: TscnNode;
}): ReactNode | null {
  const tileProps = node.properties as TileMapLayerProperties;
  const zFinal = accumulateCanvasItemZ(useEffectiveZ(), tileProps);
  const renderOrder = canvasRenderOrder({ layerRank, zFinal, sequence });
  const { model, status } = useTileSetModel(tileProps.tile_set);
  // A y-sorted layer is decomposed into per-Y groups here instead of rendering
  // through <TileMapLayer>, so its CanvasItem tint has to be resolved here too —
  // the same `useCanvasItemTint` the component's body receives. Hardcoding white
  // left y-sorted tiles as the only 2D drawable a modulate could not reach,
  // which showed up as a dungeon whose props took the CanvasModulate and whose
  // stonework did not.
  // This path bypasses <TileMapLayer>, so it reproduces the CanvasItem ritual's
  // material resolution and light-mode-gated canvas tint itself.
  const material = useCanvasItemMaterial(tileProps);
  const canvasModulate = useCanvasModulateFor(material);
  const { color, opacity } = useCanvasItemTint(tileProps, canvasModulate);
  // This path bypasses CanvasItem2D, so the accumulated z the lights are culled
  // against is the one the draw-order key above already resolved — `item.effectiveZ`
  // is accumulated from `YSortContext`, which has no provider and always starts at 0.
  const lighting = useCanvasItemLighting(material, tileProps.light_mask, zFinal);
  const allCells = tileProps.cells ?? null;
  // When expanded by the y-sort pass, tileData.cells holds the filtered Y-group cells.
  const cells = item.tileData?.cells ?? allCells;
  // `visible` and `enabled` gate the ordinary path through <CanvasItem2D>'s
  // group and the `props.enabled &&` in the body. This path bypasses both, so
  // without these two a hidden or disabled y-sorted layer drew every tile.
  const drawable =
    tileProps.visible !== false && tileProps.enabled && !!cells?.length && status === 'loaded';

  // One of these is mounted PER TILE ROW, so the partition is memoised: without
  // it every row re-buckets its cells on every render of the whole sorted list.
  // Gated on `drawable` too — a hidden layer still mounts a renderer per row,
  // and bucketing cells nothing will draw is the cost hiding it should remove.
  const cellsBySource = useMemo(
    () => (drawable && model && cells?.length ? drawnSources(model, cells) : null),
    [drawable, model, cells]
  );

  // The layer's own Node2D offset. <CanvasItem2D> applies it on the ordinary
  // path; this one bypasses it, and `layerWorldY` above already folds
  // `position.y` into the rows' sort keys — so dropping it here drew the whole
  // map offset from where it sorted. Godot's +Y is DOWN, hence the negation.
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
