/**
 * A type-specific override on an instanced GridMap, end to end on the real
 * platformer fixtures and parser. `stage.tscn` overrides the `data` of
 * `stage/grid_map.tscn`, so the merged GridMap carries the stage's 2921-cell
 * layout, not the sub-scene's 2616-cell one.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TscnParser } from '../parser/TscnParser';
import { mergeInstanceRoot } from './mergeInstanceRoot';
import { resolveInstancePath } from './SubResourceResolver';
import { resolveLiveNode } from '../r3f/liveSceneTree';
import { decodeGridMapCells, type GridMapCell } from '../nodes/3d/gridmap/cellData';
import type { GridMapProperties } from '../nodes/3d/gridmap/types';
import type { TscnNode, TscnScene } from '../parser/types';

const here = dirname(fileURLToPath(import.meta.url));
const platformerDir = resolve(here, '../../../../scenes/demos/3d/platformer');

/** Parse a committed platformer fixture by its path relative to the platformer dir. */
const parseFixture = (relPath: string): TscnScene =>
  new TscnParser().parse(readFileSync(resolve(platformerDir, relPath), 'utf8'));

function findByName(nodes: readonly TscnNode[], name: string): TscnNode | null {
  for (const n of nodes) {
    if (n.name === name) return n;
    const hit = findByName(n.children, name);
    if (hit) return hit;
  }
  return null;
}

const gridMapCells = (node: TscnNode | null): GridMapCell[] =>
  decodeGridMapCells((node!.properties as GridMapProperties).cells);

const bbox = (cells: GridMapCell[]) => ({
  minX: Math.min(...cells.map((c) => c.x)),
  maxX: Math.max(...cells.map((c) => c.x)),
  minZ: Math.min(...cells.map((c) => c.z)),
  maxZ: Math.max(...cells.map((c) => c.z)),
});

describe('mergeInstanceRoot — platformer GridMap fixture (instance data override)', () => {
  it('renders the stage override layout (2921 cells), not the base grid_map.tscn layout (2616)', () => {
    const base = parseFixture('stage/grid_map.tscn');
    const stage = parseFixture('stage/stage.tscn');

    // The instanced sub-scene is a single GridMap root carrying the base layout.
    expect(base.nodes).toHaveLength(1);
    expect(base.nodes[0]!.type).toBe('GridMap');
    const baseCells = gridMapCells(base.nodes[0]!);
    expect(baseCells).toHaveLength(2616);

    // The stage's GridMap is a type-less instance with a `data` override.
    const instanceNode = findByName(stage.nodes, 'GridMap');
    expect(instanceNode).not.toBeNull();
    expect(instanceNode!.instance).toContain('1_t0f53');
    expect(instanceNode!.type).toBe('Node'); // no type= → base Node parser

    const merged = mergeInstanceRoot(instanceNode!, { nodes: base.nodes });
    expect(merged).not.toBeNull();
    expect(merged!.type).toBe('GridMap');

    const mergedCells = gridMapCells(merged);
    // The override layout wins.
    expect(mergedCells).toHaveLength(2921);

    // And it extends the level past the base layout's edge cells.
    const baseBox = bbox(baseCells);
    const mergedBox = bbox(mergedCells);
    const extendsOutward =
      mergedBox.minX < baseBox.minX ||
      mergedBox.maxX > baseBox.maxX ||
      mergedBox.minZ < baseBox.minZ ||
      mergedBox.maxZ > baseBox.maxZ;
    expect(extendsOutward).toBe(true);
  });

  it('delivers the override layout through the real render-path resolver (loader cache → merge)', () => {
    // The production path the tree, viewport and inspector use: resolveLiveNode
    // resolves the instance's ExtResource, reads the sub-scene from the loader
    // cache (a TscnParser-parsed scene with raw props, as `getCached` returns it)
    // and merges.
    const stage = parseFixture('stage/stage.tscn');
    const gridMapScene = parseFixture('stage/grid_map.tscn');

    const instanceNode = findByName(stage.nodes, 'GridMap');
    const scenePath = resolveInstancePath(instanceNode!.instance!, stage.externalResources);
    expect(scenePath).toBe('res://stage/grid_map.tscn');

    const sceneCache = { getCached: (p: string) => (p === scenePath ? gridMapScene : undefined) };

    const resolved = resolveLiveNode('Stage/GridMap', stage.nodes, {
      externalResources: stage.externalResources,
      sceneCache,
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.type).toBe('GridMap');
    expect(gridMapCells(resolved)).toHaveLength(2921);
  });

  it('delivers the override two instance levels deep (game.tscn → Stage → GridMap)', () => {
    // game.tscn instances stage.tscn ("Stage"), which instances grid_map.tscn
    // ("GridMap") with the `data` override. The override survives both collapse
    // levels: resolveLiveNode descends into Stage, switching to stage.tscn's
    // resource scope, then collapses the nested GridMap instance.
    const game = parseFixture('game.tscn');
    const stage = parseFixture('stage/stage.tscn');
    const gridMapScene = parseFixture('stage/grid_map.tscn');

    const sceneByPath: Record<string, TscnScene> = {
      'res://stage/stage.tscn': stage,
      'res://stage/grid_map.tscn': gridMapScene,
    };
    const sceneCache = { getCached: (p: string) => sceneByPath[p] };

    const resolved = resolveLiveNode('Game/Stage/GridMap', game.nodes, {
      externalResources: game.externalResources,
      sceneCache,
    });
    expect(resolved).not.toBeNull();
    expect(resolved!.type).toBe('GridMap');
    expect(gridMapCells(resolved)).toHaveLength(2921);
  });
});
