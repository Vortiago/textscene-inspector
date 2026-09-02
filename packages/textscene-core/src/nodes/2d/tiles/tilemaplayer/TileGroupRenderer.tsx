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
import { drawnSources, tileSourceZ } from '../../../../r3f/tileSourceZ.js';
import type { TileMapLayerProperties } from './types.js';
import { useTileSetModel } from '../../../../r3f/useTileSetModel.js';
import { TileSourceMesh } from '../../../../r3f/TileSourceMesh.js';
import { ySortItemId, type YSortItem } from '../../../../r3f/ySortItems.js';
import type { YSortGroupDescription } from '../../../../r3f/NodeComponentRegistry.js';

/** Render a TileMapLayer Y-group as TileSourceMeshes at draw position `z`. */
export function TileGroupRenderer({ item, z, band, node }: {
  item: YSortItem;
  /** The Y-group's full draw position (z-index bucket + y-sort rank), carried by the group. */
  z: number;
  /** Gap to the next rank — the room this group's atlas sources may use. */
  band: number;
  node: TscnNode;
}): ReactNode | null {
  const tileProps = node.properties as TileMapLayerProperties;
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
  // against comes from the sort item, which already carries it.
  const lighting = useCanvasItemLighting(material, tileProps.light_mask, item.effectiveZ);
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
        position={[originX, originY, z]}
      />
    );
  }

  return (
    <group name={`TileGroup_${node.name}_${ySortItemId(item)}`} position={[originX, originY, z]}>
      {cellsBySource.map(({ sourceId, sourceIndex, sourceCount, source, cells: sourceCells }) => (
        <TileSourceMesh
          key={`${sourceId}_${ySortItemId(item)}`}
          source={source}
          cells={sourceCells}
          grid={model}
          z={tileSourceZ(sourceIndex, sourceCount, band)}
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

/** What the y-sort pass needs from a layer, read once per node. */
export function describeYSortLayer(node: TscnNode): YSortGroupDescription {
  const props = node.properties as TileMapLayerProperties;
  return {
    tileSetRef: props.tile_set ?? '',
    positionY: props.position?.y ?? 0,
    ySortOrigin: (props.y_sort_origin as number) ?? 0,
    cells: props.cells ?? null,
  };
}
