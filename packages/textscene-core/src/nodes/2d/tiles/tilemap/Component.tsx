/**
 * Draws a TileMap, the deprecated multi-layer node: each layer's rendering quadrants,
 * each a lit canvas item of one batched mesh per atlas source. An unresolvable TileSet or undecodable layer data leaves the
 * transform-only group with its children (ADR-0008).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import { multiplyModulate, type CanvasItemTint } from '../../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { layerQuadrants } from '../../../../resources/tileset/renderingQuadrants';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { allocateNodePaintRange, canvasRenderOrder, packPaintRanges } from '../../../../r3f/canvasPaintOrder';
import { useLayerRank, usePaintRange } from '../../../../r3f/contexts/PaintOrderContext';
import {
  accumulateCanvasItemZ,
  useCanvasLayerIndex,
  useEffectiveZ,
} from '../../../../r3f/lighting2d/canvasItemPlacement';
import { TileQuadrants } from '../../../../r3f/TileQuadrants';
import { useTileSetModel } from '../../../../r3f/useTileSetModel';
import type { TileMapLayerData, TileMapProperties } from './types';

export function TileMap({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapProperties;
  const { model, status } = useTileSetModel(props.tile_set);

  // Godot's TileMap `add_child`s a TileMapLayer CanvasItem per layer and forwards
  // `set_z_index` to it (`scene/2d/tile_map.cpp:279,376`), so each layer takes
  // its own canvas key. Read outside `ownItems`, where the ambient z is still the
  // parent's, which this node's own `z_final` accumulates on.
  const layerRank = useLayerRank(useCanvasLayerIndex());
  const ownZFinal = accumulateCanvasItemZ(useEffectiveZ(), props);
  const paintRange = usePaintRange();
  // The layers are internal front children in Godot, in no `.tscn` child list,
  // so they draw from the `front` run, between this node and its authored
  // children. Packed, so a squeezed run clamps them inside it.
  const layerSequences = useMemo(() => {
    const { front } = allocateNodePaintRange(paintRange, node);
    return packPaintRanges(
      front,
      props.layers.map(() => 1),
      front.base
    ).map((run) => run.base);
  }, [paintRange, node, props.layers]);

  // Parsed layers never change identity, so the batched geometries survive unrelated re-renders.
  const layerGroups = useMemo(() => {
    if (!model) return null;
    return props.layers.flatMap((layer, layerIndex) => {
      if (!layer.enabled || !layer.cells?.length) return [];
      // A layer is a child CanvasItem with `z_as_relative` at its default, so
      // its `z_index` accumulates onto the TileMap's own `z_final`.
      const zFinal = accumulateCanvasItemZ(ownZFinal, { z_index: layer.zIndex });
      const layout = {
        ySortEnabled: layer.ySortEnabled,
        ySortOrigin: layer.ySortOrigin,
        quadrantSize: props.rendering_quadrant_size,
      };
      return [
        {
          layerIndex,
          layer,
          zFinal,
          quadrants: layerQuadrants(layer.cells, model, layout),
          renderOrder: canvasRenderOrder({ layerRank, zFinal, sequence: layerSequences[layerIndex]! }),
        },
      ];
    });
  }, [model, props.layers, props.rendering_quadrant_size, layerRank, ownZFinal, layerSequences]);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      ownItems={(tint, material) =>
        status === 'loaded' && model && layerGroups
          ? layerGroups.map((group) => (
              // Each layer draws at its own place in the canvas, so its key rides
              // its group: three reads the nearest enclosing group first.
              <CanvasItemGroup key={group.layerIndex} renderOrder={group.renderOrder}>
                <TileQuadrants
                  quadrants={group.quadrants}
                  model={model}
                  tint={layerTint(tint, group.layer)}
                  material={material}
                  lightMask={props.light_mask}
                  zFinal={group.zFinal}
                  name={node.name}
                />
              </CanvasItemGroup>
            ))
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
