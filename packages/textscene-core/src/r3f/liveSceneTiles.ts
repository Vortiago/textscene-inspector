/**
 * The children a tile layer adds for its scene tiles, as the live tree holds them. `_scenes_update_cell`
 * instantiates the scene of each cell and adds it after the authored children (`tile_map_layer.cpp:1626-1651`),
 * so every pass over the tree covers the instances. Pure, no React.
 */

import type { SceneScope } from '../parser/types.js';
import type { LiveNode } from '../resources/liveNode.js';
import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { sceneTileCells, type SceneTileCell } from '../resources/tileset/sceneTileCells.js';
import {
  sceneTilePlacement,
  type SceneRootKind,
  type SceneTilePlacement,
} from '../resources/tileset/sceneTilePlacement.js';
import type { TileSetModel } from '../resources/tileset/types.js';
import type { SceneFile } from '../resources/formats/packedscene/kind.js';
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData.js';
import type { TileMapLayerProperties } from '../nodes/2d/tiles/tilemaplayer/types.js';
import type { TileMapProperties } from '../nodes/2d/tiles/tilemap/types.js';
import type { Node2DProperties } from '../nodes/base/node2d/types.js';
import { multiplyTransform2D, transform2DDecompose } from '../godot/math/transform2d.js';
import { node2DLocalTransform } from './node2dTransform.js';
import type { Vector2 } from '../godot/math/vector.js';

/** What the tree knows of a tile's scene: the root it merges, a failed or refused load, or no answer yet. */
export type SceneTileRoot = 'canvas-item' | 'no-canvas-item' | 'failed' | 'refused' | 'pending';

/** The scene tiles of one layer node. */
export interface SceneTiles {
  /** The instance children, after the authored ones, in the order of the cells. */
  readonly children: readonly LiveNode[];
  /** The tiles the editor marks with a disc: no scene, a refused root or `display_placeholder`. */
  readonly placeholderTiles: readonly SceneTileCell[];
}

/** The cells a node instantiates scene tiles for, or null for a node that holds no tile layer. */
export function sceneTileLayerCells(node: LiveNode): readonly PlacedCell[] | null {
  if (node.type === 'TileMapLayer') {
    const { enabled, cells, drawsSceneTiles } = node.properties as Partial<TileMapLayerProperties>;
    // A layer that is not enabled frees its scenes (`tile_map_layer.cpp:1574-1580`). A TileMap's
    // layer leaves its scenes to the TileMap.
    return enabled !== false && drawsSceneTiles !== false && cells ? cells : null;
  }
  if (node.type === 'TileMap') {
    const { layers } = node.properties as Partial<TileMapProperties>;
    return layers?.flatMap((layer) => (layer.enabled && layer.cells ? layer.cells : [])) ?? null;
  }
  return null;
}

/**
 * The scene tiles of `cells`. `rootOf` judges the scene a tile names, as the tree merges it. A
 * scene not yet loaded keeps its child, which draws nothing and shows no disc until it does.
 */
export function sceneTilesOf(
  model: TileSetModel,
  cells: readonly PlacedCell[],
  scope: SceneScope,
  rootOf: (instance: LiveNode) => SceneTileRoot
): SceneTiles {
  const allTiles = model.sceneSources.size ? sceneTileCells(model, cells) : [];
  const instances = new Map<SceneFile, LiveNode>();
  const roots = new Map<SceneFile, SceneTileRoot>();
  const rootOfScene = (scene: SceneFile): SceneTileRoot => {
    let root = roots.get(scene);
    if (root === undefined) {
      const instance = instanceNode(scene, scope);
      instances.set(scene, instance);
      root = rootOf(instance);
      roots.set(scene, root);
    }
    return root;
  };
  const names = new TileNames();
  const children: LiveNode[] = [];
  const placeholderTiles: SceneTileCell[] = [];
  for (const sceneTile of allTiles) {
    const { cell, tile } = sceneTile;
    const root = tile.scene && rootOfScene(tile.scene);
    // A scene that failed to load, or whose root is no CanvasItem, is no scene of the TileSet
    // (`tile_set.cpp:5828-5829`), so the tile gets a disc (`tile_map_layer.cpp:1683-1699`).
    const isSceneless = !root || root === 'failed' || root === 'no-canvas-item';
    if (isSceneless || tile.displayPlaceholder) placeholderTiles.push(sceneTile);
    // One Godot refuses to instantiate is valid (`:1631`), but `instantiate()` returns null (`:1632`).
    if (isSceneless || root === 'refused') continue;
    const placement = { grid: model, coords: cell.coords, alternativeId: cell.alternativeId };
    children.push(tileChild(instances.get(tile.scene!)!, names.nameAt(cell.coords), placement));
  }
  return { children, placeholderTiles };
}

/** The root kind of a merged instance root, or null for one that is no CanvasItem. */
export function sceneRootKindOf(rootType: string): SceneRootKind | null {
  if (descendsFromClass(rootType, 'Control')) return 'control';
  if (descendsFromClass(rootType, 'Node2D')) return 'node2d';
  return null;
}

/**
 * `root` placed at its cell. A Control moves by `map_to_local` (`tile_map_layer.cpp:1635-1636`), which
 * its layout applies after the file's. A Node2D takes `xform * own transform`, which also flips and
 * transposes it (`:1706-1723`).
 */
export function placedSceneTileRoot(
  root: LiveNode,
  { grid, coords, alternativeId }: SceneTilePlacement
): LiveNode {
  const kind = sceneRootKindOf(root.type);
  if (!kind) return root;
  const placement = sceneTilePlacement(grid, coords, alternativeId, kind);
  if (kind === 'control') return { ...root, controlPositionShift: { x: placement.tx, y: placement.ty } };
  const own = node2DLocalTransform(root.properties as Partial<Node2DProperties>);
  const placed = transform2DDecompose(multiplyTransform2D(placement, own));
  return { ...root, properties: { ...root.properties, ...placed } };
}

/**
 * Names a tile's child by its cell, so a change elsewhere in the layers leaves the name, and so the
 * mounted instance, alone. A cell that a second layer of a TileMap holds again takes a numbered name.
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

/** The instance of the scene file a tile names, which the tree judges once for every tile of it. */
function instanceNode(scene: SceneFile, scope: SceneScope): LiveNode {
  return {
    name: scene.path,
    type: 'Node',
    parent: '.',
    children: [],
    properties: { instance: scene.path },
    rawProperties: {},
    instance: scene.path,
    scope,
  };
}

/** The child one tile adds: the instance, named for its cell, which the edited scene does not own. */
function tileChild(instance: LiveNode, name: string, sceneTile: SceneTilePlacement): LiveNode {
  return {
    ...instance,
    name,
    properties: { ...instance.properties, name },
    isUnowned: true,
    sceneTile,
  };
}
