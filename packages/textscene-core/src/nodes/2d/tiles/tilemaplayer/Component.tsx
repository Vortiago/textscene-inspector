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
import { drawnSources } from '../../../../r3f/drawnSources';
import { TileSourceMesh } from '../../../../r3f/TileSourceMesh';
import { useTileSetModel } from '../../../../r3f/useTileSetModel';
import type { TileMapLayerProperties } from './types';

export function TileMapLayer({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapLayerProperties;
  const { model, status } = useTileSetModel(props.tile_set);
  const cells = props.cells ?? null;

  // The tree-order band this layer may spread its atlas sources across.

  // Stable per-source partition: parsed cells never change identity, so the
  // batched geometries survive unrelated re-renders (and only rebuild on data).
  const cellsBySource = useMemo(
    () => (model && cells?.length ? drawnSources(model, cells) : null),
    [model, cells]
  );

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
                renderOrder={sourceIndex}
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
