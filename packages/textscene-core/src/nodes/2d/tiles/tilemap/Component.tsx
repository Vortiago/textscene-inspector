/**
 * Draws a TileMap, the deprecated multi-layer node. Each layer is a TileMapLayer child of the TileMap
 * in the live tree (`r3f/liveTileMapLayers.ts`), which draws its own quadrants. The TileMap draws the
 * placeholder discs of its scene tiles. A y-sorted TileMap states its layers and scene tiles through
 * <YSortExtraChildrenProvider>, so its one YSortDispatcher sorts them with its child nodes.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../../r3f/components/CanvasItem2D';
import { useNodePath } from '../../../../r3f/contexts/NodePathContext';
import { useTileSetModel } from '../../../../r3f/useTileSetModel';
import { YSortExtraChildrenProvider } from '../../../../r3f/ySortExtraChildren';
import { tileMapLayerChildren } from '../../../../r3f/liveTileMapLayers';
import { FrontChildren, TailChildren } from '../shared/InternalChildren';
import { useSceneTiles } from '../shared/useSceneTiles';
import { LayerPlaceholders } from './LayerPlaceholders';
import type { TileMapProperties } from './types';

export function TileMap({ node, children }: NodeComponentProps) {
  const props = node.properties as TileMapProperties;
  const { model } = useTileSetModel(props.tile_set);
  // The TileMap, not a layer, holds the instances of every layer (`tile_map_layer.cpp:1645-1652`).
  const sceneTiles = useSceneTiles(node);
  const path = useNodePath() ?? node.name;
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
      {props.y_sort_enabled ? (
        <YSortExtraChildrenProvider
          path={path}
          leading={tileMapLayerChildren(node)}
          trailing={sceneTiles.children}
        >
          {children}
        </YSortExtraChildrenProvider>
      ) : (
        <>
          <FrontChildren node={node} internals={tileMapLayerChildren(node)} />
          {children}
          <TailChildren node={node} internals={sceneTiles.children} />
        </>
      )}
    </CanvasItem2D>
  );
}
