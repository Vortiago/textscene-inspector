/**
 * <TileMap> (deprecated multi-layer node, superseded by TileMapLayer) —
 * renders each enabled layer's cells as batched textured quads, one mesh per
 * (layer × atlas source).
 *
 * DRAW ORDER. Godot's TileMap is a wrapper that `add_child`s a real
 * `TileMapLayer` CanvasItem per layer and forwards `set_z_index` straight to it
 * (`scene/2d/tile_map.cpp:279,376`), so a layer is a canvas item in its OWN
 * right: its `z_index` interleaves with the TileMap's SIBLINGS, not merely with
 * the other layers. Each layer therefore takes its own canvas key
 * (`canvasPaintOrder.ts`) from the run this node reserves, and the atlas
 * batches within a layer order among themselves on their meshes' own
 * `renderOrder` — a batching artifact, since Godot interleaves a layer's cells
 * across sources in scan order.
 *
 * A layer's
 * `modulate` multiplies onto its pixels (composed in sRGB like the rest of
 * the CanvasItem chain). Unresolvable TileSet or undecodable layer data
 * degrades to the transform-only group with children intact (ADR-0008).
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

  // The pieces of this node's own canvas key, so each LAYER can compose one of
  // its own. Read here rather than inside `body`: `<CanvasItem2D>` publishes
  // its accumulated z to its CHILDREN, so the ambient here is still the
  // parent's — which is exactly what this node's own `z_final` accumulates on.
  const layerRank = useLayerRank(useCanvasLayerIndex());
  const ownZFinal = accumulateCanvasItemZ(useEffectiveZ(), props);
  const paintRange = usePaintRange();
  // Layer sequences come from the run `reservesRoom` held back for exactly
  // them (`canvasPaintOrder.ts`), which no authored child can be allocated
  // into — the layers are internal children in Godot and appear in no
  // `.tscn` child list, so nothing else can claim these values.
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
              // Each layer draws at its OWN place in the canvas, so its key
              // rides its group — three reads a drawn object's position from
              // the nearest enclosing group before the object's own order.
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
