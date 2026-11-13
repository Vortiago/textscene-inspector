/**
 * Draws a TileMap, the deprecated multi-layer node: each layer's rendering quadrants, each a lit
 * canvas item of one batched mesh per source run. An unresolvable TileSet or undecodable layer
 * data leaves the transform-only group with its children (ADR-0008). A y-sorted TileMap hands its
 * layers to <YSortDispatcher> as child TileMapLayers, which sort with its child nodes.
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
import { useTileSetModel, type TileSetStatus } from '../../../../r3f/useTileSetModel';
import { YSortDispatcher } from '../../../../r3f/YSortDispatcher';
import type { TscnNode } from '../../../../parser/types';
import type { TileMapLayerProperties } from '../tilemaplayer/types';
import type { TileSetModel } from '../../../../resources/tileset/types';
import { SceneTileInstances } from '../shared/SceneTileInstances';
import { LayerPlaceholders } from './LayerPlaceholders';
import { useSceneTileNodes, type SceneTileDrawing } from '../shared/useSceneTileNodes';
import type { PlacedCell } from '../shared/tileData';
import { childCanvasItemProperties } from '../shared/childCanvasItem';
import type { TileMapLayerData, TileMapProperties } from './types';
import type { Rgba } from '../../../../godot/math/math';

export function TileMap({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapProperties;
  const { model, status } = useTileSetModel(props.tile_set);
  // The TileMap, not a layer, holds the instances of every layer (`tile_map_layer.cpp:1645-1652`).
  const enabledCells = useMemo(() => enabledLayerCells(props.layers), [props.layers]);
  const sceneTiles = useSceneTileNodes(model, enabledCells);
  if (!props.y_sort_enabled) {
    return (
      <LayeredTileMap node={node} model={model} status={status} sceneTiles={sceneTiles}>
        {children}
      </LayeredTileMap>
    );
  }
  return (
    // The sort of the world walk in `children` is left out: this one sorts the layers with the children.
    <YSortedTileMap node={node} model={model} sceneTiles={sceneTiles} />
  );
}

/** The cells of the layers that are enabled, layer by layer: the order the TileMap adds their instances in. */
function enabledLayerCells(layers: readonly TileMapLayerData[]): PlacedCell[] {
  return layers.flatMap((layer) => (layer.enabled ? (layer.cells ?? []) : []));
}

function YSortedTileMap({
  node,
  model,
  sceneTiles,
}: { model: TileSetModel | null; sceneTiles: SceneTileDrawing } & NodeComponentProps) {
  const props = node.properties as TileMapProperties;
  const withLayers = useMemo(() => withLayerNodes(node, sceneTiles.instances), [node, sceneTiles.instances]);
  return (
    <CanvasItem2D
      node={node}
      props={props}
      ownItems={(state) =>
        model && (
          <LayerPlaceholders
            grid={model}
            layers={props.layers}
            tiles={sceneTiles.placeholderTiles}
            modulate={state.tint.inherited}
          />
        )
      }
    >
      <YSortDispatcher node={withLayers} />
    </CanvasItem2D>
  );
}

/**
 * The TileMap with its layers in front of its child nodes, as Godot's internal front children are.
 * A layer node is named `@TileMapLayer@<index>`, as Godot names a generated node, so no authored
 * child shares its path. The scene tile instances come last, as `add_child` appends them, and the
 * layers leave them to the TileMap.
 */
function withLayerNodes(map: TscnNode, sceneTiles: readonly TscnNode[]): TscnNode {
  const { layers, ...props } = map.properties as TileMapProperties;
  const layerNodes = layers.map((layer, index): TscnNode => ({
    name: `@TileMapLayer@${index}`,
    type: 'TileMapLayer',
    parent: '.',
    properties: {
      ...childCanvasItemProperties(props),
      tile_set: props.tile_set,
      enabled: layer.enabled,
      rendering_quadrant_size: props.rendering_quadrant_size,
      cells: layer.cells,
      drawsSceneTiles: false,
      y_sort_enabled: layer.ySortEnabled,
      y_sort_origin: layer.ySortOrigin,
      z_index: layer.zIndex,
      ...(layer.modulate && { modulate: layer.modulate }),
    } satisfies TileMapLayerProperties,
    rawProperties: {},
    children: [],
  }));
  return { ...map, children: [...layerNodes, ...map.children, ...sceneTiles] };
}

interface LayeredTileMapProps extends NodeComponentProps {
  model: TileSetModel | null;
  status: TileSetStatus;
  sceneTiles: SceneTileDrawing;
}

function LayeredTileMap({ node, model, status, sceneTiles, children }: LayeredTileMapProps) {
  const props = node.properties as TileMapProperties;
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
      ownItems={(state) => (
        <>
          {status === 'loaded' && model && layerQuadrantSets
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
            : null}
          {model && (
            <LayerPlaceholders
              grid={model}
              layers={props.layers}
              tiles={sceneTiles.placeholderTiles}
              modulate={state.tint.inherited}
            />
          )}
        </>
      )}
    >
      {children}
      <SceneTileInstances node={node} instances={sceneTiles.instances} />
    </CanvasItem2D>
  );
}

/** Fold `layer_N/modulate` into the node's own-pixel modulate (sRGB). */
function layerTint(tint: CanvasItemTint, layer: TileMapLayerData): Rgba {
  return layer.modulate ? multiplyModulate(tint.self, layer.modulate) : tint.self;
}
