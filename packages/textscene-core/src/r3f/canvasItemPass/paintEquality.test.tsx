/**
 * Both walks draw each node at the sequence the paint pass gives it: the world walk reads it through
 * `useNodePaint`, and the Control walk fills each `SolveNode`'s `paint` from it. Every 2D node the pass holds is read by one walk, so a walk that
 * allocates its own sequence fails here. A y-sorted parent re-packs its children's runs, so the
 * world walk below one is compared only for its runs.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../parser/types';
import { TscnParser } from '../../parser/TscnParser';
import { fixturesDir } from '../../parser/testing/parserKit';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { parseTscnContent } from '../hooks/useParsedScene';
import { DispatchedScene } from '../testing/DispatchedScene';
import { settleLoads } from '../testing/settleLoads';
import { liveTreeOf, type LiveTree } from '../liveSceneTree';
import { liveScenePassResults } from '../liveScenePass';
import { useLiveTreeSelection } from '../useLiveSceneTree';
import { ControlCanvasLayer } from '../controls/native/ControlCanvasLayer';
import type { SolveNode } from '../controls/native/solveTree';
import { ysortsChildren } from '../canvasPaintOrder';
import { descendsFromClass } from '../../godot/classdb/classBaseTypes';
import { canvasPaintPass, type CanvasItemPaint } from './canvasItemPaint';

import '../nodes/index';
import '../controls/index';

/**
 * Written by the mocked readers during one mount, and cleared before the next. The last write wins:
 * an instance draws its node as authored until its sub-scene loads.
 */
const worldPaints = new Map<string, CanvasItemPaint>();
const controlNodes = new Map<string, SolveNode>();

vi.mock('./nodePaint', async (importOriginal) => {
  const original = await importOriginal<typeof import('./nodePaint')>();
  return {
    ...original,
    useNodePaint: (node: TscnNode, path: string | null) => {
      const paint = original.useNodePaint(node, path);
      if (path !== null) worldPaints.set(path, paint);
      return paint;
    },
  };
});

vi.mock('../controls/native/ControlCanvasWalker', async (importOriginal) => {
  const original = await importOriginal<typeof import('../controls/native/ControlCanvasWalker')>();
  const record = (node: SolveNode): void => {
    controlNodes.set(node.path, node);
    node.children.forEach(record);
  };
  return {
    ...original,
    ControlCanvasWalker: (props: Parameters<typeof original.ControlCanvasWalker>[0]) => {
      props.tree.forEach(record);
      return original.ControlCanvasWalker(props);
    },
  };
});

/** The 2D fixtures whose order a y-sort, a tile layer, a CanvasGroup, a clip, a Control or an instance decides. */
const FIXTURES = [
  ...readdirSync(fixturesDir()).filter((name) =>
    /^unit-(control-y-sort|tile-map-layer|canvas-group|clip-children)/.test(name)
  ),
  'unit-clip-children-behind-owner.tscn',
  'unit-graph-edit-frame-order.tscn',
  'unit-control-containers.tscn',
  'complex-2d-gui.tscn',
  'unit-control-instanced-hud.tscn',
  'unit-canvas-paint-two-instances.tscn',
  'unit-sprite-2d-shared-world-content.tscn',
  'unit-canvas-layer-light-order-by-tree.tscn',
  'unit-control-top-level.tscn',
].filter((name, index, all) => name.endsWith('.tscn') && all.indexOf(name) === index);

const parser = new TscnParser();

/** The PackedScene paths `text` names, as `res://` paths. */
function packedScenePaths(text: string): string[] {
  return [...text.matchAll(/\[ext_resource type="PackedScene" path="(res:\/\/[^"]+\.tscn)"/g)].map(
    (m) => m[1]!
  );
}

/** Every sub-scene `text` instances, read from the fixtures folder, by `res://` path. */
function subScenesOf(text: string, seen = new Map<string, string>()): Map<string, string> {
  for (const path of packedScenePaths(text)) {
    if (seen.has(path)) continue;
    const sub = readFileSync(resolve(fixturesDir(), path.slice('res://'.length)), 'utf8');
    seen.set(path, sub);
    subScenesOf(sub, seen);
  }
  return seen;
}

/** Written only by `mounted`, and unmounted after each test, so no earlier scene writes the maps. */
let renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>> | null = null;

afterEach(async () => {
  await renderer?.unmount();
  renderer = null;
});

/** Mounts the fixture `name` with both walks and returns the live tree they draw. */
function mounted(name: string): Promise<LiveTree> {
  return mountedText(name, readFileSync(resolve(fixturesDir(), name), 'utf8'));
}

/** Mounts the scene `text`, saved as `name`, with both walks and returns the live tree they draw. */
async function mountedText(name: string, text: string): Promise<LiveTree> {
  worldPaints.clear();
  controlNodes.clear();
  const { sceneGraph, error } = parseTscnContent(text, `res://${name}`);
  if (!sceneGraph) throw new Error(`expected ${name} to parse, got ${error}`);
  const fake = createFakeResourceLoader();
  for (const [path, sub] of subScenesOf(text)) fake.scenes.seed(path, parser.parse(sub));
  const nodes = sceneGraph.scenes.get(sceneGraph.rootScene)!.nodes;
  let tree: LiveTree | null = null;
  const capture = (found: LiveTree): void => {
    tree = found;
  };
  renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene
      sceneGraph={sceneGraph}
      workspace="2d"
      loader={fake.loader}
      around={(dispatched) => (
        <>
          {dispatched}
          <ControlCanvasLayer nodes={nodes} />
          <LiveTreeProbe onTree={capture} />
        </>
      )}
    />
  );
  await settleLoads();
  if (!tree) throw new Error(`expected a live tree for ${name}, got none`);
  return tree;
}

function LiveTreeProbe({ onTree }: { onTree: (tree: LiveTree) => void }): null {
  useLiveTreeSelection((live) => {
    onTree(liveTreeOf(live.roots, live.ctx));
    return live;
  }, Object.is);
  return null;
}

/** The live paths below a y-sorted parent, whose runs the world walk re-packs in sort order. */
function sortedPaths(tree: LiveTree): Set<string> {
  const sorted = new Set<string>();
  tree.fold<boolean, void>(false, ({ step, path }, isBelowSort, descend) => {
    if (isBelowSort) sorted.add(path);
    descend(isBelowSort || ysortsChildren(step.node));
  });
  return sorted;
}

/** The live paths of 3D nodes, which no 2D walk draws. */
function spatialPaths(tree: LiveTree): Set<string> {
  const spatial = new Set<string>();
  tree.fold<void, void>(undefined, ({ step, path }, _, descend) => {
    if (descendsFromClass(step.node.type, 'Node3D')) spatial.add(path);
    descend();
  });
  return spatial;
}

describe('both walks read the paint pass for every node they draw', () => {
  it.each(FIXTURES)('%s', async (name) => {
    const tree = await mounted(name);
    const paint = liveScenePassResults(canvasPaintPass, tree);
    const sorted = sortedPaths(tree);
    const spatial = spatialPaths(tree);

    const world = [...worldPaints]
      .filter(([path]) => paint.has(path) && !sorted.has(path))
      .map(([path, found]) => [path, found.own] as const);
    const worldPass = world.map(([path]) => [path, paint.get(path)!.own]);
    expect(world).toEqual(worldPass);

    const controls = [...controlNodes.values()].filter((node) => paint.has(node.path));
    const controlFound = controls.map((node) => [
      node.path,
      node.paint.own,
      node.paint.back.base,
      node.paint.layer,
    ]);
    const controlPass = controls.map((node) => {
      const own = paint.get(node.path)!;
      return [node.path, own.own, own.back.base, own.layer];
    });
    expect(controlFound).toEqual(controlPass);
    expect(world.length + controls.length).toBeGreaterThan(0);
    const unread = [...paint.keys()].filter(
      (path) => !worldPaints.has(path) && !controlNodes.has(path) && !spatial.has(path)
    );
    expect(unread).toEqual([]);
  });
});

describe('a y-sort moves the runs of the items it sorts, and only those', () => {
  it('gives each sorted item a run of its own, with its pieces inside it', async () => {
    // A y-sorted CanvasGroup's children are items of their own, so its body draws its own pixels
    // in a run of one value, as `_cull_canvas_item` draws a sorted item (`renderer_canvas_cull.cpp:477-490`).
    await mountedText(
      'zz-sorted-group.tscn',
      `[gd_scene format=3]

[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Group" type="CanvasGroup" parent="."]
position = Vector2(0, 100)
y_sort_enabled = true

[node name="Inner" type="Polygon2D" parent="Group"]
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)

[node name="Ball" type="Polygon2D" parent="."]
position = Vector2(0, 200)
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
`
    );
    const items = ['Root/Group', 'Root/Group/Inner', 'Root/Ball'].map((path) => worldPaints.get(path)!);
    for (const item of items) {
      for (const piece of [item.own, item.back.base, item.tail.base]) {
        expect(piece).toBeGreaterThanOrEqual(item.range.base);
        expect(piece).toBeLessThanOrEqual(item.range.base + item.range.size);
      }
    }
    const ranges = items.map((item) => item.range).sort((x, y) => x.base - y.base);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i]!.base).toBeGreaterThanOrEqual(ranges[i - 1]!.base + ranges[i - 1]!.size);
    }
  });

  it('leaves a top_level item below a sorted item at its own canvas run', async () => {
    // A top_level item parents at the canvas (`canvas_item.cpp:246-267`), so the sort of the
    // item it hangs under does not move it.
    const tree = await mountedText(
      'zz-sorted-top-level.tscn',
      `[gd_scene format=3]

[node name="Root" type="Node2D"]
y_sort_enabled = true

[node name="Mid" type="Node2D" parent="."]
position = Vector2(0, 100)

[node name="Top" type="Polygon2D" parent="Mid"]
top_level = true
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)

[node name="Ball" type="Polygon2D" parent="."]
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
`
    );
    const paint = liveScenePassResults(canvasPaintPass, tree);
    expect(worldPaints.get('Root/Mid/Top')!.own).toBe(paint.get('Root/Mid/Top')!.own);
  });
});
