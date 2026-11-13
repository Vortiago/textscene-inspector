/**
 * The children a tile layer adds for its scene tiles, as the live tree holds them. `_scenes_update_cell`
 * instantiates the scene of each cell and adds it after the authored children (`tile_map_layer.cpp:1626-1651`),
 * so every pass over the tree covers the instances. Pure, no React.
 */

import type { SceneScope } from '../parser/types.js';
import type { LiveNode } from '../resources/liveNode.js';
import { descendsFromClass } from '../godot/classdb/classBaseTypes.js';
import { isControlType } from './canvasItemClass.js';
import { perObject } from '../utils/perObject.js';
import { sceneTileCells, type SceneTileCell } from '../resources/tileset/sceneTileCells.js';
import {
  sceneTilePlacement,
  type SceneRootKind,
  type SceneTilePlacement,
} from '../resources/tileset/sceneTilePlacement.js';
import type { TileGrid, TileSetModel } from '../resources/tileset/types.js';
import type { SceneFile } from '../resources/formats/packedscene/kind.js';
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData.js';
import type { TileMapLayerProperties } from '../nodes/2d/tiles/tilemaplayer/types.js';
import type { TileMapProperties } from '../nodes/2d/tiles/tilemap/types.js';
import type { Node2DProperties } from '../nodes/base/node2d/types.js';
import {
  multiplyTransform2D,
  transform2DDecompose,
  type Transform2DColumns,
} from '../godot/math/transform2d.js';
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

/** Whether `node` holds a tile layer with cells, read with no array built. */
export function hasSceneTileCells(node: LiveNode): boolean {
  if (node.type === 'TileMap') {
    const { layers } = node.properties as Partial<TileMapProperties>;
    return layers?.some((layer) => layer.enabled && layer.cells?.length) ?? false;
  }
  return (sceneTileLayerCells(node)?.length ?? 0) > 0;
}

/**
 * The scene tiles of `cells`. `rootOf` judges the scene a tile names, as the tree merges it. A
 * scene not yet loaded keeps its child, which draws nothing and shows no disc until it does.
 */
export function sceneTilesOf(
  model: TileSetModel,
  cells: readonly PlacedCell[],
  scope: SceneScope,
  rootOf: (instance: LiveNode) => JudgedRoot
): SceneTiles {
  const allTiles = model.sceneSources.size ? sceneTileCells(model, cells) : [];
  const judged = new Map<SceneFile, JudgedScene>();
  const judge = (scene: SceneFile): JudgedScene => {
    let entry = judged.get(scene);
    if (!entry) {
      const instance = instanceNode(scene, scope);
      entry = { instance, ...rootOf(instance) };
      judged.set(scene, entry);
    }
    return entry;
  };
  const names = new TileNames();
  const children: LiveNode[] = [];
  const placeholderTiles: SceneTileCell[] = [];
  for (const sceneTile of allTiles) {
    const { cell, tile } = sceneTile;
    const scene = tile.scene && judge(tile.scene);
    const root = scene && scene.root;
    // A scene that failed to load, or whose root is no CanvasItem, is no scene of the TileSet
    // (`tile_set.cpp:5828-5829`), so the tile gets a disc (`tile_map_layer.cpp:1683-1699`).
    const isSceneless = !root || root === 'failed' || root === 'no-canvas-item';
    if (isSceneless || tile.displayPlaceholder) placeholderTiles.push(sceneTile);
    // One Godot refuses to instantiate is valid (`:1631`), but `instantiate()` returns null (`:1632`).
    if (isSceneless || root === 'refused') continue;
    const placement = { grid: model, coords: cell.coords, alternativeId: cell.alternativeId };
    const pose = scene!.rootNode && placedNode2DPose(scene!.rootNode, placement);
    children.push(tileChild(scene!.instance, names.nameAt(cell.coords), placement, pose ?? undefined));
  }
  return { children, placeholderTiles };
}

/** What the tree says of a tile's scene, and the root it merges, null while it merges none. */
export interface JudgedRoot {
  readonly root: SceneTileRoot;
  readonly rootNode: LiveNode | null;
}

/** The instance node of a scene, and what the tree says of its root. */
interface JudgedScene extends JudgedRoot {
  readonly instance: LiveNode;
}

/** The root kind of a merged instance root, or null for one that is no CanvasItem. */
function sceneRootKindOf(rootType: string): SceneRootKind | null {
  if (isControlType(rootType)) return 'control';
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
  const placed = transform2DDecompose(placedNode2DTransform(root, placement));
  return { ...root, properties: { ...root.properties, ...placed } };
}

/** The transform of a Node2D `root` in its layer once placed at its cell, or null for any other root. */
function placedNode2DPose(root: LiveNode, sceneTile: SceneTilePlacement): Transform2DColumns | null {
  if (sceneRootKindOf(root.type) !== 'node2d') return null;
  const { grid, coords, alternativeId } = sceneTile;
  return placedNode2DTransform(root, sceneTilePlacement(grid, coords, alternativeId, 'node2d'));
}

/** `xform * own transform` (`tile_map_layer.cpp:1706-1723`). */
function placedNode2DTransform(root: LiveNode, placement: Transform2DColumns): Transform2DColumns {
  return multiplyTransform2D(placement, node2DLocalTransform(root.properties as Partial<Node2DProperties>));
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

/**
 * The instance of the scene file a tile names, which the tree judges once for every tile of it. The
 * same scene and scope give the same node, so a rebuilt layer keeps the steps its tiles cached.
 */
function instanceNode(scene: SceneFile, scope: SceneScope): LiveNode {
  const instances = instanceNodesOf(scene)(scope.internalResources)(scope.externalResources);
  const key = scope.instancedScenePaths?.join('\n') ?? '';
  let instance = instances.get(key);
  if (!instance) {
    instance = newInstanceNode(scene, scope);
    instances.set(key, instance);
  }
  return instance;
}

/** By the pools of the scope, not the scope object: a tree built again makes a new scope over the same pools. */
const instanceNodesOf = perObject((_scene: SceneFile) =>
  perObject((_internal: SceneScope['internalResources']) =>
    perObject((_external: SceneScope['externalResources']) => new Map<string, LiveNode>())
  )
);

function newInstanceNode(scene: SceneFile, scope: SceneScope): LiveNode {
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

/**
 * The child one tile adds: the instance, named for its cell, which the edited scene does not own. The
 * same tile gives the same node, so a layer rebuilt for an edit elsewhere leaves its mounted tiles alone.
 */
function tileChild(
  instance: LiveNode,
  name: string,
  sceneTile: SceneTilePlacement,
  placedPose: Transform2DColumns | undefined
): LiveNode {
  const { grid, coords, alternativeId } = sceneTile;
  const children = tileChildrenOf(instance)(grid);
  const pose = placedPose ? Object.values(placedPose).join(',') : '';
  const key = `${name}|${coords.x},${coords.y}|${alternativeId}|${pose}`;
  let child = children.get(key);
  if (!child) {
    child = newTileChild(instance, name, sceneTile, placedPose);
    children.set(key, child);
  }
  return child;
}

const tileChildrenOf = perObject((_instance: LiveNode) =>
  perObject((_grid: TileGrid) => new Map<string, LiveNode>())
);

function newTileChild(
  instance: LiveNode,
  name: string,
  sceneTile: SceneTilePlacement,
  placedPose: Transform2DColumns | undefined
): LiveNode {
  return {
    ...instance,
    name,
    properties: { ...instance.properties, name },
    isUnowned: true,
    sceneTile,
    ...(placedPose && { placedPose }),
  };
}
