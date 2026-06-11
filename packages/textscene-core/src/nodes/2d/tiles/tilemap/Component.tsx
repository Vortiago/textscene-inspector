/**
 * <TileMap> (legacy, multi-layer) — renders each enabled layer's cells as
 * batched textured quads, one mesh per (layer × atlas source). Draw order:
 * the layer's own z_index moves a full Z_INDEX_STEP (interleaving with
 * sibling CanvasItems like Godot), layer index breaks ties with
 * TILE_LAYER_STEP, atlas-source order with TILE_SOURCE_STEP. Unresolvable
 * TileSet or undecodable layer data degrades to the transform-only group
 * with children intact (ADR-0008).
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import {
  TILE_LAYER_STEP,
  TILE_SOURCE_STEP,
  Z_INDEX_STEP,
} from '../../../../r3f/node2dTransform';
import { TileSourceMesh } from '../../../../r3f/TileSourceMesh';
import { useTileSetModel } from '../../../../r3f/useTileSetModel';
import type { TileMapProperties } from './types';

export function TileMap({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapProperties;
  const { model, status } = useTileSetModel(props.tile_set);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ color, opacity }) =>
        status === 'loaded' && model
          ? props.layers.flatMap((layer, layerIndex) => {
              if (!layer.enabled || !layer.cells?.length) return [];
              return model.sourceOrder.map((sourceId, sourceIndex) => {
                const sourceCells = layer.cells!.filter((c) => c.sourceId === sourceId);
                if (sourceCells.length === 0) return null;
                return (
                  <TileSourceMesh
                    key={`${layerIndex}:${sourceId}`}
                    source={model.sources.get(sourceId)!}
                    cells={sourceCells}
                    grid={model}
                    z={
                      layer.zIndex * Z_INDEX_STEP +
                      layerIndex * TILE_LAYER_STEP +
                      sourceIndex * TILE_SOURCE_STEP
                    }
                    color={color}
                    opacity={opacity}
                    name={node.name}
                  />
                );
              });
            })
          : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}
