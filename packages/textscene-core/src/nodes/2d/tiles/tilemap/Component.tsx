/**
 * <TileMap> (legacy, multi-layer) — renders each enabled layer's cells as
 * batched textured quads, one mesh per (layer × atlas source). Draw order:
 * the layer's own z_index moves a full Z_INDEX_STEP (interleaving with
 * sibling CanvasItems like Godot), layer index breaks ties with
 * TILE_LAYER_STEP, atlas-source order with TILE_SOURCE_STEP. A layer's
 * `modulate` multiplies onto its pixels (composed in sRGB like the rest of
 * the CanvasItem chain). Unresolvable TileSet or undecodable layer data
 * degrades to the transform-only group with children intact (ADR-0008).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import {
  multiplyModulate,
  type CanvasItemTint,
} from '../../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import {
  TILE_LAYER_STEP,
  TILE_SOURCE_STEP,
  Z_INDEX_STEP,
} from '../../../../r3f/node2dTransform';
import { TileSourceMesh } from '../../../../r3f/TileSourceMesh';
import { useTileSetModel } from '../../../../r3f/useTileSetModel';
import type { TileMapLayerData, TileMapProperties } from './types';

export function TileMap({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapProperties;
  const { model, status } = useTileSetModel(props.tile_set);

  // Stable (layer × source) partition: parsed layers never change identity,
  // so the batched geometries survive unrelated re-renders.
  const meshEntries = useMemo(() => {
    if (!model) return null;
    return props.layers.flatMap((layer, layerIndex) => {
      if (!layer.enabled || !layer.cells?.length) return [];
      return model.sourceOrder
        .map((sourceId, sourceIndex) => ({
          key: `${layerIndex}:${sourceId}`,
          source: model.sources.get(sourceId)!,
          cells: layer.cells!.filter((c) => c.sourceId === sourceId),
          z:
            layer.zIndex * Z_INDEX_STEP +
            layerIndex * TILE_LAYER_STEP +
            sourceIndex * TILE_SOURCE_STEP,
          layer,
        }))
        .filter((entry) => entry.cells.length > 0);
    });
  }, [model, props.layers]);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={(tint) =>
        status === 'loaded' && model && meshEntries
          ? meshEntries.map((entry) => {
              const { color, opacity } = layerTint(tint, entry.layer);
              return (
                <TileSourceMesh
                  key={entry.key}
                  source={entry.source}
                  cells={entry.cells}
                  grid={model}
                  z={entry.z}
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

/** Fold `layer_N/modulate` into the node's own-pixel tint (sRGB-composed). */
function layerTint(tint: CanvasItemTint, layer: TileMapLayerData) {
  if (!layer.modulate) return { color: tint.color, opacity: tint.opacity };
  const own = multiplyModulate(tint.own, layer.modulate);
  return { color: godotColorToLinear(own), opacity: own.a };
}
