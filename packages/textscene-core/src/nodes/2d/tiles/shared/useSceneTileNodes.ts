/**
 * The instances a tile layer adds for its scene tiles, as nodes a canvas walk draws. Each scene
 * tile becomes a Node2D that carries the cell's placement, with the instance below it, so the
 * instance loader, its materials and the paint order are the ones an `instance=` node uses.
 */

import { useMemo } from 'react';
import type { SceneScope, TscnNode } from '../../../../parser/types';
import type { LiveNode, YSortRoot } from '../../../../resources/liveNode';
import { descendsFromClass } from '../../../../godot/classdb/classBaseTypes';
import { sceneTileCells, type SceneTileCell } from '../../../../resources/tileset/sceneTileCells';
import { sceneTilePlacement, type SceneRootKind } from '../../../../resources/tileset/sceneTilePlacement';
import type { TileGrid, TileScene, TileSetModel } from '../../../../resources/tileset/types';
import { perObject } from '../../../../utils/perObject';
import { useInstancedScenePaths } from '../../../../r3f/contexts/InstancedScenePathsContext';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { useLiveStepsOf } from '../../../../r3f/useLiveSceneTree';
import { parseNode2D } from '../../../base/node2d/parser';
import { TRANSFORM2D_IDENTITY, transform2DDecompose } from '../../../../godot/math/transform2d';
import { node2DLocalTransform } from '../../../../r3f/node2dTransform';
import type { Node2DLocalTransform } from '../../../base/node2d/types';
import type { Vector2 } from '../../../../godot/math/vector';
import type { PlacedCell } from './tileData';

/** The instance's name below its placement node. The Scene dock lists neither. */
const INSTANCE_NAME = 'Instance';

/** What a layer draws for the scene tiles of its cells. */
export interface SceneTileDrawing {
  /** The nodes that draw the scenes, in the order of the cells. */
  instances: TscnNode[];
  /** The tiles the editor marks with a placeholder disc: no scene, a refused root or `display_placeholder`. */
  placeholderTiles: SceneTileCell[];
}

/**
 * The scene tiles of `cells` drawn, or none with no TileSet or no cells. A caller passes no cells
 * for a layer that is not `enabled`.
 */
export function useSceneTileNodes(
  model: TileSetModel | null,
  cells: readonly PlacedCell[] | null | undefined
): SceneTileDrawing {
  // An atlas-only TileSet names no scene tile, so its cells need no scan.
  const allTiles = useMemo(
    () => (model?.sceneSources.size && cells ? sceneTileCells(model, cells) : NO_TILES),
    [model, cells]
  );
  const tiles = useMemo(() => allTiles.filter(({ tile }) => tile.scene), [allTiles]);
  const ambient = useSceneResources();
  const enclosingScenePaths = useInstancedScenePaths();
  const scope = useMemo<SceneScope>(
    () => ({ ...ambient, instancedScenePaths: enclosingScenePaths }),
    [ambient, enclosingScenePaths]
  );
  // One instance node and one live step per distinct scene: a layer repeats few scenes across many cells.
  const scenes = useMemo(() => [...new Set(tiles.map(({ tile }) => tile.scene!))], [tiles]);
  const sceneNodes = useMemo(() => scenes.map(instanceNodesOf(scope)), [scenes, scope]);
  const sceneSteps = useLiveStepsOf(sceneNodes, scope);

  return useMemo(() => {
    if (!model) return NO_DRAWING;
    // The root judged once per scene, not per tile. `set_scene_tile_scene` refuses a root that is no
    // CanvasItem, so a tile of that scene has no scene.
    const placeable = new Map<TileScene, PlaceableScene>();
    const refusedScenes = new Set<TileScene>();
    const instanceOf = instanceNodesOf(scope);
    scenes.forEach((scene, index) => {
      const step = sceneSteps[index]!;
      // A scene not yet loaded has no root to judge: its tile draws nothing and shows no disc.
      const root = step.isMerged ? rootKindOf(step.node.type) : 'node2d';
      if (root === null) refusedScenes.add(scene);
      else
        placeable.set(scene, { instance: instanceOf(scene), root, ySortRoot: ySortRootOf(step.node, root) });
    });
    const placed: LiveNode[] = [];
    const names = new TileNames();
    for (const sceneTile of tiles) {
      const scene = placeable.get(sceneTile.tile.scene!);
      if (scene) placed.push(placementNode(names.nameAt(sceneTile.cell.coords), sceneTile, scene, model));
    }
    return {
      instances: placed,
      placeholderTiles: allTiles.filter(
        ({ tile }) => !tile.scene || tile.displayPlaceholder || refusedScenes.has(tile.scene)
      ),
    };
  }, [model, allTiles, tiles, scenes, sceneSteps, scope]);
}

/**
 * Names a tile's placement node by its cell, so a change elsewhere in the layers leaves the name, and
 * so the mounted instance, alone. A cell that a second layer holds again takes a numbered name.
 */
class TileNames {
  private readonly seen = new Map<string, number>();

  nameAt({ x, y }: Vector2): string {
    const cell = `${x}_${y}`;
    const count = this.seen.get(cell) ?? 0;
    this.seen.set(cell, count + 1);
    return count === 0 ? `@SceneTile@${cell}` : `@SceneTile@${cell}@${count}`;
  }
}

/** A Node2D at its defaults: a placement node differs from it by its name and transform only. */
const PLACEMENT_DEFAULTS = parseNode2D({ type: 'Node2D', attributes: { name: '', parent: '.' } }, {});

const NO_TILES: readonly SceneTileCell[] = [];
const NO_DRAWING: SceneTileDrawing = { instances: [], placeholderTiles: [] };

/** A cell edit keeps the node of a scene it still draws, so the instances mounted below it keep their memos. */
const instanceNodesOf = perObject((scope: SceneScope) =>
  perObject((scene: TileScene) => instanceNode(scene, scope))
);

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

/** Null for a root type that is no CanvasItem, which `set_scene_tile_scene` refuses (`tile_set.cpp:5826-5827`). */
function rootKindOf(rootType: string): SceneRootKind | null {
  if (descendsFromClass(rootType, 'Control')) return 'control';
  if (descendsFromClass(rootType, 'Node2D')) return 'node2d';
  return null;
}

/**
 * The instance root as the sort reads it. A Node2D root has its own transform and z. A Control root
 * sits at its offsets, the rect of a parent with no size, and has the z of its own CanvasItem.
 */
function ySortRootOf(rootNode: LiveNode, root: SceneRootKind): YSortRoot {
  if (root === 'node2d') {
    const { z_index: zIndex = 0, z_as_relative: zAsRelative = true } = rootNode.properties as {
      z_index?: number;
      z_as_relative?: boolean;
    };
    const pose = node2DLocalTransform(rootNode.properties as Partial<Node2DLocalTransform>);
    return { pose, zIndex, zAsRelative };
  }
  const {
    offsetLeft = 0,
    offsetTop = 0,
    zIndex = 0,
    zAsRelative = true,
  } = rootNode.properties as {
    offsetLeft?: number;
    offsetTop?: number;
    zIndex?: number;
    zAsRelative?: boolean;
  };
  return { pose: { ...TRANSFORM2D_IDENTITY, tx: offsetLeft, ty: offsetTop }, zIndex, zAsRelative };
}

/** A tile scene as its tiles share it: the instance node, and its loaded root as the sort reads it. */
interface PlaceableScene {
  instance: LiveNode;
  root: SceneRootKind;
  ySortRoot: YSortRoot;
}

function placementNode(
  name: string,
  { cell }: SceneTileCell,
  { instance, root, ySortRoot }: PlaceableScene,
  grid: TileGrid
): LiveNode {
  const placement = sceneTilePlacement(grid, cell.coords, cell.alternativeId, root);
  return {
    name,
    type: 'Node2D',
    parent: '.',
    children: [instance],
    properties: { ...PLACEMENT_DEFAULTS, name, ...transform2DDecompose(placement) },
    rawProperties: {},
    isUnowned: true,
    hasControlRoot: root === 'control',
    ySortRoot,
  };
}
