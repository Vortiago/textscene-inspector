/**
 * Acceptance — instanced GridMap type-specific override, end-to-end on the real
 * platformer fixtures.
 *
 * `stage.tscn` instances `stage/grid_map.tscn` and overrides its GridMap `data`
 * with a larger cell layout. Before the fix, the type-less instance node was
 * parsed by the base Node parser, which drops `data`, so we rendered the base
 * sub-scene's 2616-cell layout instead of the stage's 2921-cell override — the
 * "coins outside the map" symptom (the extra cells extend the level edges where
 * the far coins sit).
 *
 * This drives the REAL parser + `mergeInstanceRoot` over the committed fixtures
 * (no stubs) and asserts the merged GridMap carries the OVERRIDE layout.
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
    // The OVERRIDE layout wins, end-to-end — the fix's headline effect.
    expect(mergedCells).toHaveLength(2921);

    // And it extends the level outward past the base layout — the edge cells the
    // base lacked, which is why the far coins previously sat outside the map.
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
    // Drives the PRODUCTION path the tree/viewport/inspector use: resolveLiveNode
    // finds the instance node, resolves its ExtResource against the scene's external
    // resources, reads the sub-scene from the loader cache (exactly what the real
    // ResourceLoader's getCached returns — a TscnParser-parsed scene with raw props),
    // and merges. This proves the fix isn't isolated to a direct mergeInstanceRoot call.
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
    // The real acceptance scenario: game.tscn instances stage.tscn
    // (node "Stage"), which itself instances grid_map.tscn (node "GridMap") with
    // the `data` override. The override must survive BOTH collapse levels —
    // resolveLiveNode descends into Stage (switching to stage.tscn's resource
    // scope) and then collapses the nested GridMap instance. A regression here
    // would re-render the base 2616-cell layout, putting the far coins outside it.
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
