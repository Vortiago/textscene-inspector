/**
 * The instances a tile layer adds for its scene tiles, as nodes a canvas walk draws. Each scene
 * tile becomes a Node2D that carries the cell's placement, with the instance below it, so the
 * instance loader, its materials and the paint order are the ones an `instance=` node uses.
 */

import { useEffect, useMemo, useState } from 'react';
import type { SceneScope, TscnNode } from '../../../../parser/types';
import type { LiveNode, YSortRoot } from '../../../../resources/liveNode';
import { descendsFromClass } from '../../../../godot/classdb/classBaseTypes';
import { sceneTileCells, type SceneTileCell } from '../../../../resources/tileset/sceneTileCells';
import { sceneTilePlacement, type SceneRootKind } from '../../../../resources/tileset/sceneTilePlacement';
import type { TileGrid, TileScene, TileSetModel } from '../../../../resources/tileset/types';
import { perObject } from '../../../../utils/perObject';
import { useInstancedScenePaths } from '../../../../r3f/contexts/InstancedScenePathsContext';
import { useProjectSettings } from '../../../../r3f/contexts/ProjectSettingsContext';
import {
  controlDrawTransformOf,
  controlItemOriginUnder,
  snapControlsToPixelsEnabled,
} from '../../../../r3f/controls/native/controlPixelSnap';
import type { ControlProperties } from '../../ui/control/types';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { useLiveStepsOf } from '../../../../r3f/useLiveSceneTree';
import { parseNode2D } from '../../../base/node2d/parser';
import { TRANSFORM2D_IDENTITY, transform2DDecompose } from '../../../../godot/math/transform2d';
import { node2DLocalTransform } from '../../../../r3f/node2dTransform';
import type { Node2DLocalTransform } from '../../../base/node2d/types';
import { VECTOR2_ZERO, type Vector2 } from '../../../../godot/math/vector';
import { rect2Equals, type Rect2 } from '../../../../godot/math/rect2';
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
  const snapToPixels = snapControlsToPixelsEnabled(useProjectSettings().settings);
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

  // The rect the Control walk solved for each loaded Control root. The sort reads the offsets until
  // then, and a replaced root has no entry.
  const [solvedRects, setSolvedRects] = useState<ReadonlyMap<LiveNode, Rect2>>(NO_SOLVED_RECTS);
  // A root the scene has replaced is dropped, so edits do not grow the map.
  useEffect(
    () =>
      setSolvedRects((previous) => {
        const live = new Set(sceneSteps.map(({ node }) => node));
        const kept = [...previous].filter(([root]) => live.has(root));
        return kept.length === previous.size ? previous : new Map(kept);
      }),
    [sceneSteps]
  );
  // One reporter per scene root, stable while the step is: a solve that changes a rect must not make
  // every Control tile report again.
  const reporters = useMemo(
    () =>
      sceneSteps.map(
        ({ node }) =>
          (rect: Rect2) =>
            setSolvedRects((previous) => withSolvedRect(previous, node, rect))
      ),
    [sceneSteps]
  );

  return useMemo(() => {
    if (!model) return NO_DRAWING;
    // Each scene is judged once. A scene that failed to load, or whose root is no CanvasItem, has no
    // scene and gets a disc (`tile_map_layer.cpp:1683-1699`). One Godot refuses to instantiate is
    // valid (`:1631`) but `instantiate()` returns null (`:1632`), so it draws nothing.
    const placeable = new Map<TileScene, PlaceableScene>();
    const sceneless = new Set<TileScene>();
    scenes.forEach((scene, index) => {
      const step = sceneSteps[index]!;
      // A scene not yet loaded has no root to judge: its tile draws nothing and shows no disc.
      const root = step.isMerged ? rootKindOf(step.node.type) : 'node2d';
      if (step.isFailedInstance || root === null) sceneless.add(scene);
      else if (!step.isRefusedInstance)
        placeable.set(scene, {
          instance: sceneNodes[index]!,
          root,
          ySortRootAt: ySortRootOf(step.node, root, snapToPixels, solvedRects.get(step.node)),
          reportRootRect: reporters[index]!,
        });
    });
    const placed: LiveNode[] = [];
    const names = new TileNames();
    // Every tile of a scene solves the same root, so the first tile reports it for all.
    const reporting = new Set<TileScene>();
    for (const sceneTile of tiles) {
      const tileScene = sceneTile.tile.scene!;
      const scene = placeable.get(tileScene);
      if (!scene) continue;
      const reports = !reporting.has(tileScene);
      reporting.add(tileScene);
      placed.push(placementNode(names.nameAt(sceneTile.cell.coords), sceneTile, scene, model, reports));
    }
    return {
      instances: placed,
      placeholderTiles: allTiles.filter(
        ({ tile }) => !tile.scene || tile.displayPlaceholder || sceneless.has(tile.scene)
      ),
    };
  }, [model, allTiles, tiles, scenes, sceneNodes, sceneSteps, snapToPixels, solvedRects, reporters]);
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
const NO_SOLVED_RECTS: ReadonlyMap<LiveNode, Rect2> = new Map();

/** `solved` with the rect of `root`, or `solved` itself when it holds that rect. */
function withSolvedRect(solved: ReadonlyMap<LiveNode, Rect2>, root: LiveNode, rect: Rect2) {
  const held = solved.get(root);
  return held && rect2Equals(held, rect) ? solved : new Map(solved).set(root, rect);
}

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

/** Null for a root type that is no CanvasItem, which `set_scene_tile_scene` refuses (`tile_set.cpp:5828-5829`). */
function rootKindOf(rootType: string): SceneRootKind | null {
  if (descendsFromClass(rootType, 'Control')) return 'control';
  if (descendsFromClass(rootType, 'Node2D')) return 'node2d';
  return null;
}

/** The instance root as the sort reads it, given where the placement node puts it in the layer. */
type YSortRootAt = (placement: Vector2) => YSortRoot;

/** The sort root of a scene's root: a Control by its solved rect, a Node2D by its own transform and z. */
function ySortRootOf(
  rootNode: LiveNode,
  root: SceneRootKind,
  snapToPixels: boolean,
  solvedRect: Rect2 | undefined
): YSortRootAt {
  if (root === 'control')
    return controlYSortRootAt(rootNode.properties as ControlProperties, snapToPixels, solvedRect);
  const sortRoot = { pose: node2DLocalTransform(rootNode.properties as Partial<Node2DLocalTransform>) };
  return () => sortRoot;
}

/**
 * A Control root sorts on the origin of its canvas item (`control.cpp:727-737`). The tile sets its
 * position to `map_to_local + position` (`tile_map_layer.cpp:1636`), so the snap rounds that sum.
 * The solved rect holds the position the minimum size and grow leave (`control.cpp:1773-1797`).
 */
function controlYSortRootAt(
  control: ControlProperties,
  snapToPixels: boolean,
  solvedRect: Rect2 | undefined
): YSortRootAt {
  const { offsetLeft = 0, offsetTop = 0, offsetRight = 0, offsetBottom = 0 } = control;
  const rect = solvedRect ?? {
    x: offsetLeft,
    y: offsetTop,
    w: offsetRight - offsetLeft,
    h: offsetBottom - offsetTop,
  };
  const transform = controlDrawTransformOf(control, rect);
  const rootAt: YSortRootAt = (placement) => {
    // The placement node adds its own position back.
    const origin = controlItemOriginUnder(rect, placement, transform, snapToPixels);
    const pose = { ...TRANSFORM2D_IDENTITY, tx: origin.x, ty: origin.y };
    return { pose };
  };
  // Without the snap the placement cancels, so every tile of the scene shares one root.
  if (snapToPixels) return rootAt;
  const sharedRoot = rootAt(VECTOR2_ZERO);
  return () => sharedRoot;
}

/** A tile scene as its tiles share it: the instance node, and its loaded root as the sort reads it. */
interface PlaceableScene {
  instance: LiveNode;
  root: SceneRootKind;
  ySortRootAt: YSortRootAt;
  /** Receives the rect the Control walk solves for a Control root. */
  reportRootRect: (rect: Rect2) => void;
}

function placementNode(
  name: string,
  { cell }: SceneTileCell,
  { instance, root, ySortRootAt, reportRootRect }: PlaceableScene,
  grid: TileGrid,
  reportsRootRect: boolean
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
    ySortRoot: ySortRootAt({ x: placement.tx, y: placement.ty }),
    ...(reportsRootRect && root === 'control' && { reportRootRect }),
  };
}
