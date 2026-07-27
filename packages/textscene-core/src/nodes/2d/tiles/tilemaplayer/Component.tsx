/**
 * <TileMapLayer> — renders the layer's placed cells (decoded at parse time) as
 * batched textured quads, one mesh per atlas source. The TileSet resolves from
 * the scene's SubResources; an unresolvable TileSet or undecodable tile data
 * degrades to the transform-only group with children intact (ADR-0008).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import { canvasItemBlendState } from '../../../../resources/materials/canvasitemmaterial/renderer';
import { CanvasItemBlendMode } from '../../../../resources/materials/canvasitemmaterial/types';
import { tileSourceZ } from '../../../../r3f/tileSourceZ';
import { useYSortSlot } from '../../../../r3f/contexts/YSortContext';
import { TileSourceMesh } from '../../../../r3f/TileSourceMesh';
import { useTileSetModel } from '../../../../r3f/useTileSetModel';
import type { TileMapLayerProperties } from './types';

export function TileMapLayer({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapLayerProperties;
  const { model, status } = useTileSetModel(props.tile_set);
  const cells = props.cells ?? null;

  // Stable per-source partition: parsed cells never change identity, so the
  // batched geometries survive unrelated re-renders (and only rebuild on data).
  // The tree-order band this layer may spread its atlas sources across.
  const slot = useYSortSlot();

  const cellsBySource = useMemo(() => {
    if (!model || !cells?.length) return null;
    return model.sourceOrder
      .map((sourceId, sourceIndex) => ({
        sourceId,
        sourceIndex,
        source: model.sources.get(sourceId)!,
        cells: cells.filter((c) => c.sourceId === sourceId),
      }))
      .filter((entry) => entry.cells.length > 0);
  }, [model, cells]);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ color, opacity }, material, lighting) =>
        props.enabled && status === 'loaded' && model && cellsBySource
          ? cellsBySource.map(({ sourceId, sourceIndex, source, cells: sourceCells }) => (
              <TileSourceMesh
                key={sourceId}
                source={source}
                cells={sourceCells}
                grid={model}
                z={tileSourceZ(sourceIndex, cellsBySource.length, slot.width)}
                color={color}
                opacity={opacity}
                name={node.name}
                blend={canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX)}
                lighting={lighting}
              />
            ))
          : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}
