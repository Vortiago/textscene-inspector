/**
 * <TileMapLayer> renders the layer's placed cells (decoded at parse time) as its rendering
 * quadrants, each a lit canvas item of batched textured quads. The TileSet resolves from the
 * scene's SubResources. An unresolvable TileSet or undecodable tile data degrades to the
 * transform-only group with children intact (ADR-0008). A y-sorted layer draws no quadrants of
 * its own: <YSortDispatcher> sorts its rows with its child nodes.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import type { TileSetModel } from '../../../../resources/tileset/types';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import { layerQuadrants } from '../../../../resources/tileset/renderingQuadrants';
import { TileQuadrants } from '../../../../r3f/TileQuadrants';
import { useTileSetModel } from '../../../../r3f/useTileSetModel';
import { YSortDispatcher } from '../../../../r3f/YSortDispatcher';
import { SceneTileInstances } from '../shared/SceneTileInstances';
import { ScenePlaceholders } from '../shared/ScenePlaceholders';
import { useSceneTileNodes, type SceneTileDrawing } from '../shared/useSceneTileNodes';
import type { TileMapLayerProperties } from './types';

export function TileMapLayer({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapLayerProperties;
  const { model, status } = useTileSetModel(props.tile_set);
  const sceneTiles = useSceneTileNodes(model, props.cells, {
    isEnabled: props.enabled && props.drawsSceneTiles !== false,
    owner: '',
  });
  if (!props.y_sort_enabled) {
    return (
      <QuadrantLayer node={node} model={model} status={status} sceneTiles={sceneTiles}>
        {children}
      </QuadrantLayer>
    );
  }
  // A scene tile is a child canvas item of the layer, so it sorts with the layer's rows and children.
  const { instances, placeholderTiles } = sceneTiles;
  const withSceneTiles = instances.length ? { ...node, children: [...node.children, ...instances] } : node;
  return (
    <CanvasItem2D
      node={node}
      props={props}
      ownItems={(state) =>
        model && <ScenePlaceholders grid={model} tiles={placeholderTiles} modulate={state.tint.inherited} />
      }
    >
      <YSortDispatcher node={withSceneTiles}>{children}</YSortDispatcher>
    </CanvasItem2D>
  );
}

interface QuadrantLayerProps extends NodeComponentProps {
  model: TileSetModel | null;
  status: 'pending' | 'loaded' | 'unavailable';
  sceneTiles: SceneTileDrawing;
}

function QuadrantLayer({ node, model, status, sceneTiles, children }: QuadrantLayerProps) {
  const props = node.properties as TileMapLayerProperties;
  const cells = props.cells ?? null;
  const { y_sort_origin: ySortOrigin, rendering_quadrant_size: quadrantSize } = props;

  // Parsed cells never change identity, so the batched geometries survive
  // unrelated re-renders and rebuild only on new data.
  const quadrants = useMemo(
    () =>
      model && cells?.length
        ? layerQuadrants(cells, model, { ySortEnabled: false, ySortOrigin, quadrantSize })
        : null,
    [model, cells, ySortOrigin, quadrantSize]
  );

  return (
    <CanvasItem2D
      node={node}
      props={props}
      ownItems={(state) => (
        <>
          {props.enabled && status === 'loaded' && model && quadrants && (
            <TileQuadrants
              quadrants={quadrants}
              model={model}
              selfTint={state.tint.self}
              material={state.material}
              lightMask={state.lightMask}
              zFinal={state.zFinal}
              name={node.name}
              sampler={state.sampler}
            />
          )}
          {model && (
            <ScenePlaceholders
              grid={model}
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
