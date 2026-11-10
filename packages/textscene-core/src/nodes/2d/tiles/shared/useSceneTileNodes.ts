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
interface InstancedSceneTile {
  tile: SceneTileCell;
  scene: TileScene;
}

/** What a layer draws for the scene tiles of its cells. */
export interface SceneTileDrawing {
  /** The nodes that draw the scenes, in the order of the cells. */
  instances: TscnNode[];
  /** The tiles the editor marks with a placeholder disc: no scene, a refused root or `display_placeholder`. */
  placeholderTiles: SceneTileCell[];
}

/**
 * The scene tiles of `cells` drawn, or none while the layer is not `enabled` or has no TileSet.
 * `owner` makes the instance names unique across the layers of a TileMap, whose instances share
 * the TileMap as parent.
 */
export function useSceneTileNodes(
  model: TileSetModel | null,
  cells: readonly PlacedCell[] | null | undefined,
  { isEnabled, owner }: { isEnabled: boolean; owner: string }
): SceneTileDrawing {
  const allTiles = useMemo(
    () => (model && isEnabled && cells ? sceneTileCells(model, cells) : NO_TILES),
    [model, isEnabled, cells]
  );
  const tiles = useMemo(() => instancedTiles(allTiles), [allTiles]);
  const ambient = useSceneResources();
  const enclosingScenePaths = useInstancedScenePaths();
  const scope = useMemo<SceneScope>(
    () => ({ ...ambient, instancedScenePaths: enclosingScenePaths }),
    [ambient, enclosingScenePaths]
  );
  const instances = useMemo(() => tiles.map((tile) => instanceNode(tile.scene, scope)), [tiles, scope]);
  const steps = useLiveStepsOf(instances, scope);

  return useMemo(() => {
    if (!model) return NO_DRAWING;
    // `set_scene_tile_scene` refuses a root that is no CanvasItem, so that tile has no scene.
    const refused = new Set<SceneTileCell>();
    const placed: LiveNode[] = [];
    tiles.forEach((tile, index) => {
      const root = rootKindOf(steps[index]!.node.type);
      if (root === null) refused.add(tile.tile);
      else
        placed.push(placementNode(`@SceneTile@${owner}${index}`, tile.tile, instances[index]!, model, root));
    });
    return {
      instances: placed,
      placeholderTiles: allTiles.filter(
        (tile) => !tile.tile.scene || tile.tile.displayPlaceholder || refused.has(tile)
      ),
    };
  }, [model, allTiles, tiles, instances, steps, owner]);
}

const NO_TILES: readonly SceneTileCell[] = [];
const NO_DRAWING: SceneTileDrawing = { instances: [], placeholderTiles: [] };

function instancedTiles(tiles: readonly SceneTileCell[]): InstancedSceneTile[] {
  return tiles.flatMap((tile) => (tile.tile.scene ? [{ tile, scene: tile.tile.scene }] : []));
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
