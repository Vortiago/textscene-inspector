/**
 * Draws a TileMap, the deprecated multi-layer node: one batched mesh per layer and
 * atlas source. An unresolvable TileSet or undecodable layer data leaves the
 * transform-only group with its children (ADR-0008).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import { canvasItemBlendState } from '../../../../resources/materials/canvasitemmaterial/renderer';
import { CanvasItemBlendMode } from '../../../../resources/materials/canvasitemmaterial/types';
import {
  multiplyModulate,
  type CanvasItemTint,
} from '../../../../r3f/canvasItemModulate';
import { godotColorToLinear } from '../../../../r3f/godotColor';
import { drawnSources } from '../../../../r3f/drawnSources';
import { CanvasItemGroup } from '../../../../r3f/components/CanvasItemGroup';
import { allocatePaintRange, canvasRenderOrder } from '../../../../r3f/canvasPaintOrder';
import { useLayerRank, usePaintRange } from '../../../../r3f/contexts/PaintOrderContext';
import {
  accumulateCanvasItemZ,
  useCanvasLayerIndex,
  useEffectiveZ,
} from '../../../../r3f/lighting2d/canvasItemPlacement';
import { TileSourceMesh } from '../../../../r3f/TileSourceMesh';
import { useTileSetModel } from '../../../../r3f/useTileSetModel';
import type { TileMapLayerData, TileMapProperties } from './types';

export function TileMap({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapProperties;
  const { model, status } = useTileSetModel(props.tile_set);

  // Godot's TileMap `add_child`s a TileMapLayer CanvasItem per layer and forwards
  // `set_z_index` to it (`scene/2d/tile_map.cpp:279,376`), so each layer takes
  // its own canvas key. Read outside `body`, where the ambient z is still the
  // parent's, which this node's own `z_final` accumulates on.
  const layerRank = useLayerRank(useCanvasLayerIndex());
  const ownZFinal = accumulateCanvasItemZ(useEffectiveZ(), props);
  const paintRange = usePaintRange();
  // Layer sequences come from the run `reservesRoom` holds back for them
  // (`canvasPaintOrder.ts`). The layers are internal children in Godot, in no
  // `.tscn` child list, so no authored child can claim these values.
  const layerSequences = useMemo(
    () => allocatePaintRange(paintRange, node.children).tail.base,
    [paintRange, node.children]
  );

  // Stable (layer × source) partition: parsed layers never change identity,
  // so the batched geometries survive unrelated re-renders.
  const meshEntries = useMemo(() => {
    if (!model) return null;
    const entries = props.layers.flatMap((layer, layerIndex) => {
      if (!layer.enabled || !layer.cells?.length) return [];
      return drawnSources(model, layer.cells).map(({ sourceId, source, cells, sourceIndex }) => ({
        key: `${layerIndex}:${sourceId}`,
        source,
        cells,
        layer,
        layerIndex,
        sourceIndex,
      }));
    });
    return entries;
  }, [model, props.layers]);

  /** One `CanvasItemGroup` per drawn layer, each at that layer's own key. */
  const layerGroups = useMemo(() => {
    if (!meshEntries) return null;
    const byLayer = new Map<number, typeof meshEntries>();
    for (const entry of meshEntries) {
      const bucket = byLayer.get(entry.layerIndex);
      if (bucket) bucket.push(entry);
      else byLayer.set(entry.layerIndex, [entry]);
    }
    return [...byLayer.entries()].map(([layerIndex, entries]) => ({
      layerIndex,
      entries,
      renderOrder: canvasRenderOrder({
        layerRank,
        // A layer is a child CanvasItem with `z_as_relative` at its default, so
        // its `z_index` accumulates onto the TileMap's own `z_final`.
        zFinal: accumulateCanvasItemZ(ownZFinal, { z_index: entries[0]!.layer.zIndex }),
        sequence: layerSequences + layerIndex,
      }),
    }));
  }, [meshEntries, layerRank, ownZFinal, layerSequences]);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={(tint, material, lighting) =>
        status === 'loaded' && model && layerGroups
          ? layerGroups.map((group) => (
              // Each layer draws at its own place in the canvas, so its key rides
              // its group: three reads the nearest enclosing group first. Within
              // a layer, sources order by mesh `renderOrder`, a batching artifact.
              <CanvasItemGroup key={group.layerIndex} renderOrder={group.renderOrder}>
                {group.entries.map((entry) => {
                  const { color, opacity } = layerTint(tint, entry.layer);
                  return (
                    <TileSourceMesh
                      key={entry.key}
                      source={entry.source}
                      cells={entry.cells}
                      grid={model}
                      renderOrder={entry.sourceIndex}
                      color={color}
                      opacity={opacity}
                      name={node.name}
                      blend={canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX)}
                      lighting={lighting}
                    />
                  );
                })}
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
