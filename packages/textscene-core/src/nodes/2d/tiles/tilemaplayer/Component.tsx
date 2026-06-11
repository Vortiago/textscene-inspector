/**
 * <TileMapLayer> — renders the layer's placed cells (decoded at parse time) as
 * batched textured quads, one mesh per atlas source. The TileSet resolves from
 * the scene's SubResources; an unresolvable TileSet or undecodable tile data
 * degrades to the transform-only group with children intact (ADR-0008).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import { TILE_SOURCE_STEP } from '../../../../r3f/node2dTransform';
import { TileSourceMesh } from '../../../../r3f/TileSourceMesh';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { tileSetFromScene } from '../../../../resources/tileset/resolveTileSet';
import type { TileMapLayerProperties } from './types';

export function TileMapLayer({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapLayerProperties;
  const { internalResources, externalResources } = useSceneResources();

  const model = useMemo(
    () =>
      props.tile_set
        ? tileSetFromScene(props.tile_set, internalResources, externalResources)
        : null,
    [props.tile_set, internalResources, externalResources]
  );
  const cells = props.cells ?? null;

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ color, opacity }) =>
        props.enabled && model && cells?.length
          ? model.sourceOrder.map((sourceId, sourceIndex) => {
              const source = model.sources.get(sourceId)!;
              const sourceCells = cells.filter((c) => c.sourceId === sourceId);
              if (sourceCells.length === 0) return null;
              return (
                <TileSourceMesh
                  key={sourceId}
                  source={source}
                  cells={sourceCells}
                  grid={model}
                  z={sourceIndex * TILE_SOURCE_STEP}
                  color={color}
                  opacity={opacity}
                  name={node.name}
                />
              );
            })
          : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}
