/**
 * Draws a TileMap, the deprecated multi-layer node: each layer's rendering quadrants, each a lit
 * canvas item of one batched mesh per source run. An unresolvable TileSet or undecodable layer
 * data leaves the transform-only group with its children (ADR-0008).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import { multiplyModulate, type CanvasItemTint } from '../../../../r3f/canvasItemModulate';
import { layerQuadrants } from '../../../../resources/tileset/renderingQuadrants';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { allocateNodePaintRange, packPaintRanges } from '../../../../r3f/canvasPaintOrder';
import { usePaintRange } from '../../../../r3f/contexts/PaintOrderContext';
import { childCanvasPlace } from '../../../../r3f/canvasItemState';
import { TileQuadrants } from '../../../../r3f/TileQuadrants';
import { useTileSetModel } from '../../../../r3f/useTileSetModel';
import type { TileMapLayerData, TileMapProperties } from './types';
import type { Rgba } from '../../../../godot/math/math';

export function TileMap({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapProperties;
  const { model, status } = useTileSetModel(props.tile_set);
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
  // The quadrants depend on no paint-order input, so a move in the canvas keeps them too.
  const layerQuadrantSets = useMemo(() => {
    if (!model) return null;
    return props.layers.flatMap((layer, layerIndex) => {
      if (!layer.enabled || !layer.cells?.length) return [];
      const layout = {
        ySortEnabled: layer.ySortEnabled,
        ySortOrigin: layer.ySortOrigin,
        quadrantSize: props.rendering_quadrant_size,
      };
      return [{ layerIndex, layer, quadrants: layerQuadrants(layer.cells, model, layout) }];
    });
  }, [model, props.layers, props.rendering_quadrant_size]);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      ownItems={(state) =>
        status === 'loaded' && model && layerQuadrantSets
          ? layerQuadrantSets.map((set) => {
              // Godot's TileMap adds a TileMapLayer CanvasItem per layer and forwards
              // `set_z_index` to it (`scene/2d/tile_map.cpp:279,376`), so each layer
              // takes a key of its own at its own sequence.
              const place = childCanvasPlace(
                { key: state.keyAt(layerSequences[set.layerIndex]!), zFinal: state.zFinal },
                set.layer.zIndex
              );
              return (
                // Each layer draws at its own place in the canvas, so its key rides
                // its group: three reads the nearest enclosing group first.
                <CanvasItemGroup key={set.layerIndex} renderOrder={place.key}>
                  <TileQuadrants
                    quadrants={set.quadrants}
                    model={model}
                    selfTint={layerTint(state.tint, set.layer)}
                    material={state.material}
                    lightMask={state.lightMask}
                    zFinal={place.zFinal}
                    name={node.name}
                    sampler={state.sampler}
                  />
                </CanvasItemGroup>
              );
            })
          : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}

/** Fold `layer_N/modulate` into the node's own-pixel modulate (sRGB). */
function layerTint(tint: CanvasItemTint, layer: TileMapLayerData): Rgba {
  return layer.modulate ? multiplyModulate(tint.self, layer.modulate) : tint.self;
}
