/**
 * The paint pass gives each node the sequence the two walks give it today: the world walk's
 * `useNodePaintSequence` for each drawn item, and the Control walk's `paintSequence`,
 * `backSequence` and `layerSequence` for each `SolveNode`, on every fixture of the value list.
 * A y-sorted parent re-packs its children's runs, so the world walk below one is not compared.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
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
import { canvasPaintPass } from './canvasItemPaint';

import '../nodes/index';
import '../controls/index';

/**
 * Written by the mocked readers during one mount, and cleared before the next. The last write wins:
 * an instance draws its node as authored until its sub-scene loads.
 */
const worldSequences = new Map<string, number>();
const controlNodes = new Map<string, SolveNode>();

vi.mock('../contexts/PaintOrderContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('../contexts/PaintOrderContext')>();
  const { useNodePath } = await import('../contexts/NodePathContext');
  return {
    ...original,
    useNodePaintSequence: (node: TscnNode): number => {
      const sequence = original.useNodePaintSequence(node);
      const path = useNodePath();
      if (path !== null) worldSequences.set(path, sequence);
      return sequence;
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

/** The fixtures of the value list in `#1533`. */
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

/** Mounts `name` with both walks and returns the live tree they draw. */
async function mounted(name: string): Promise<LiveTree> {
  worldSequences.clear();
  controlNodes.clear();
  const text = readFileSync(resolve(fixturesDir(), name), 'utf8');
  const { sceneGraph, error } = parseTscnContent(text, `res://${name}`);
  if (!sceneGraph) throw new Error(`expected ${name} to parse, got ${error}`);
  const fake = createFakeResourceLoader();
  for (const [path, sub] of subScenesOf(text)) fake.scenes.seed(path, parser.parse(sub));
  const nodes = sceneGraph.scenes.get(sceneGraph.rootScene)!.nodes;
  let tree: LiveTree | null = null;
  const capture = (found: LiveTree): void => {
    tree = found;
  };
  await ReactThreeTestRenderer.create(
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

describe('the paint pass gives the sequences the two walks give', () => {
  it.each(FIXTURES)('%s', async (name) => {
    const tree = await mounted(name);
    const paint = liveScenePassResults(canvasPaintPass, tree);
    const sorted = sortedPaths(tree);

    const world = [...worldSequences].filter(([path]) => paint.has(path) && !sorted.has(path));
    const worldPass = world.map(([path]) => [path, paint.get(path)!.own]);
    expect(world).toEqual(worldPass);

    const controls = [...controlNodes.values()].filter((node) => paint.has(node.path));
    const controlFound = controls.map((node) => [
      node.path,
      node.paintSequence,
      node.backSequence,
      node.layerSequence,
    ]);
    const controlPass = controls.map((node) => {
      const own = paint.get(node.path)!;
      return [node.path, own.own, own.back.base, own.layer];
    });
    expect(controlFound).toEqual(controlPass);
    expect(world.length + controls.length).toBeGreaterThan(0);
  });
});
