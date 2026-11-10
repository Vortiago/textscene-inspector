/**
 * The instances a tile layer adds for its scene tiles, as nodes a canvas walk draws. Each scene
 * tile becomes a Node2D that carries the cell's placement, with the instance below it, so the
 * instance loader, its materials and the paint order are the ones an `instance=` node uses.
 */

import { useMemo } from 'react';
import type { SceneScope, TscnNode } from '../../../../parser/types';
import type { LiveNode } from '../../../../resources/liveNode';
import { descendsFromClass } from '../../../../godot/classdb/classBaseTypes';
import { sceneTileCells, type SceneTileCell } from '../../../../resources/tileset/sceneTileCells';
import { sceneTilePlacement, type SceneRootKind } from '../../../../resources/tileset/sceneTilePlacement';
import type { TileScene, TileSetModel } from '../../../../resources/tileset/types';
import { useInstancedScenePaths } from '../../../../r3f/contexts/InstancedScenePathsContext';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { useLiveStepsOf } from '../../../../r3f/useLiveSceneTree';
import { parseNode2D } from '../../../base/node2d/parser';
import type { PlacedCell } from './tileData';

/** The instance's name below its placement node. The Scene dock lists neither. */
const INSTANCE_NAME = 'Instance';

/** A scene tile that has a scene to instantiate. */
type InstancedSceneTile = SceneTileCell & { scene: TileScene };

/**
 * The nodes that draw the scene tiles of `cells`, in the order of the cells, or none while the
 * layer is not `enabled` or has no TileSet. `owner` makes the names unique across the layers of a
 * TileMap, whose instances share the TileMap as parent.
 */
export function useSceneTileNodes(
  model: TileSetModel | null,
  cells: readonly PlacedCell[] | null | undefined,
  { isEnabled, owner }: { isEnabled: boolean; owner: string }
): TscnNode[] {
  const tiles = useMemo(
    () => (model && isEnabled && cells ? instancedTiles(model, cells) : NONE),
    [model, isEnabled, cells]
  );
  const ambient = useSceneResources();
  const enclosingScenePaths = useInstancedScenePaths();
  const scope = useMemo<SceneScope>(
    () => ({ ...ambient, instancedScenePaths: enclosingScenePaths }),
    [ambient, enclosingScenePaths]
  );
  const instances = useMemo(() => tiles.map((tile) => instanceNode(tile.scene, scope)), [tiles, scope]);
  const steps = useLiveStepsOf(instances, scope);

  return useMemo(() => {
    if (!model) return [];
    return tiles.flatMap((tile, index) => {
      const root = rootKindOf(steps[index]!.node.type);
      // `set_scene_tile_scene` refuses a root that is no CanvasItem, so the tile has no scene.
      if (root === null) return [];
      return [placementNode(`@SceneTile@${owner}${index}`, tile, instances[index]!, model, root)];
    });
  }, [model, tiles, instances, steps, owner]);
}

const NONE: readonly InstancedSceneTile[] = [];

function instancedTiles(model: TileSetModel, cells: readonly PlacedCell[]): InstancedSceneTile[] {
  return sceneTileCells(model, cells).flatMap((tile) =>
    tile.tile.scene ? [{ ...tile, scene: tile.tile.scene }] : []
  );
}

/** The instance, resolved in the tables of the file that holds the TileSet, not the scene's. */
function instanceNode(scene: TileScene, ambient: SceneScope): LiveNode {
  return {
    name: INSTANCE_NAME,
    type: 'Node',
    parent: '.',
    children: [],
    properties: { name: INSTANCE_NAME, parent: '.', instance: scene.ref },
    rawProperties: {},
    instance: scene.ref,
    scope: {
      externalResources: scene.externalResources,
      internalResources: scene.internalResources,
      instancedScenePaths: ambient.instancedScenePaths,
    },
  };
}

/**
 * Null for a root type that is no CanvasItem. A root not yet loaded reads as `Node`, a Node2D here:
 * the instance draws nothing until its scene arrives.
 */
function rootKindOf(rootType: string): SceneRootKind | null {
  if (descendsFromClass(rootType, 'Control')) return 'control';
  if (descendsFromClass(rootType, 'Node2D') || rootType === 'Node') return 'node2d';
  return null;
}

function placementNode(
  name: string,
  { cell }: SceneTileCell,
  instance: LiveNode,
  grid: TileSetModel,
  root: SceneRootKind
): LiveNode {
  const { a, b, c, d, tx, ty } = sceneTilePlacement(grid, cell.coords, cell.alternativeId, root);
  const heading = { type: 'Node2D', attributes: { name, parent: '.' } };
  return {
    name,
    type: 'Node2D',
    parent: '.',
    children: [instance],
    properties: parseNode2D(heading, { transform: `Transform2D(${a}, ${b}, ${c}, ${d}, ${tx}, ${ty})` }),
    rawProperties: {},
    isUnowned: true,
  };
}
