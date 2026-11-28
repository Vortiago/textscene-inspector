import { buildSceneGraph, type ParsedScene, type SceneGraph } from '../core/SceneGraph.js';
import type { TscnExternalResource, TscnNode } from '../parser/types.js';
import { layerRawOverride } from '../resources/layerRawOverride.js';
import { shareSeating } from '../parser/sceneTreeBuilder.js';
import { nodePathNames } from '../godot/string/nodePath.js';
import { joinPath } from '../utils/nodePath.js';
import { perObject } from '../utils/perObject.js';
import { writeRevision, type PropertyTexts, type SceneWrites } from './sceneWrites.js';

/** Where a write lands in the root file: on a node of it, or as an override heading below an instance. */
type Landing =
  | { readonly kind: 'node'; readonly at: readonly number[] }
  | {
      readonly kind: 'override';
      readonly at: readonly number[];
      readonly subPath: string;
      readonly name: string;
    };

/** A file node, with the index chain from the roots that reaches it. */
interface Reached {
  readonly node: TscnNode;
  readonly at: readonly number[];
}

/** The path below `node`'s parent that a child of the file sits at: its `instanceSubPath`, then its name. */
function seatOf(child: TscnNode): string[] {
  return nodePathNames(joinPath(child.instanceSubPath ?? '', child.name));
}

function startsWith(names: readonly string[], prefix: readonly string[]): boolean {
  return prefix.length <= names.length && prefix.every((name, i) => names[i] === name);
}

/** The child of `node` whose seat the most names of `rest` reach, as the file's own heading names it. */
function deepestSeated(node: TscnNode, rest: readonly string[]): { index: number; length: number } | null {
  let best: { index: number; length: number } | null = null;
  node.children.forEach((child, index) => {
    const seat = seatOf(child);
    if (startsWith(rest, seat) && seat.length > (best?.length ?? 0)) best = { index, length: seat.length };
  });
  return best;
}

/** The file node's own heading, else an override heading below the nearest instance, else null. */
function landingOf(roots: readonly TscnNode[], livePath: string): Landing | null {
  const names = nodePathNames(livePath);
  const rootIndex = roots.findIndex((root) => root.name === names[0]);
  if (rootIndex < 0) return null;
  let reached: Reached = { node: roots[rootIndex]!, at: [rootIndex] };
  let instance: { reached: Reached; below: string[] } | null = null;
  let rest = names.slice(1);
  while (rest.length > 0) {
    if (reached.node.instance) instance = { reached, below: [] };
    const seated = deepestSeated(reached.node, rest);
    if (!seated) break;
    const consumed = rest.slice(0, seated.length);
    if (instance) instance.below.push(...consumed);
    reached = { node: reached.node.children[seated.index]!, at: [...reached.at, seated.index] };
    rest = rest.slice(seated.length);
  }
  if (rest.length === 0) return { kind: 'node', at: reached.at };
  if (reached.node.instance) instance = { reached, below: [] };
  if (!instance) return null;
  const inside = [...instance.below, ...rest];
  return {
    kind: 'override',
    at: instance.reached.at,
    subPath: inside.slice(0, -1).join('/'),
    name: inside.at(-1)!,
  };
}

/** Whether a write can land at `livePath`: a node of the file, or one an instance of it holds. */
export function isWritable(graph: SceneGraph, livePath: string): boolean {
  return landingOf(rootNodesOf(graph), livePath) !== null;
}

/** An instance or an override heading keeps the text alone, since the merge parses it. */
function laid(node: TscnNode, texts: PropertyTexts): TscnNode {
  if (node.instance || node.overridesExistingNode) {
    return { ...node, rawProperties: { ...node.rawProperties, ...texts }, rawPropertiesOrderReliable: false };
  }
  return { ...node, ...layerRawOverride(node, node, texts) };
}

/** The override heading of a write to a node an instance holds, `parent` spelt from the root. */
function overrideHeading(
  instancePath: string,
  subPath: string,
  name: string,
  texts: PropertyTexts
): TscnNode {
  const parent = joinPath(instancePath, subPath) || '.';
  return {
    name,
    type: 'Node',
    parent,
    children: [],
    rawProperties: { ...texts },
    rawPropertiesOrderReliable: false,
    properties: {},
    overridesExistingNode: true,
    ...(subPath ? { instanceSubPath: subPath } : {}),
  };
}

function replacing<T>(items: readonly T[], index: number, item: T): T[] {
  const copy = [...items];
  copy[index] = item;
  return copy;
}

// A replay reuses a parent while the child in its changed slot stays the same.
const childSlots = perObject((_parent: TscnNode) => new Map<number, (child: TscnNode) => TscnNode>());

function parentWithChild(parent: TscnNode, index: number, child: TscnNode): TscnNode {
  const slots = childSlots(parent);
  let withChild = slots.get(index);
  if (!withChild) {
    withChild = perObject((replacement: TscnNode) => ({
      ...parent,
      children: replacing(parent.children, index, replacement),
    }));
    slots.set(index, withChild);
  }
  return withChild(child);
}

// Two instances can share a file node while a host writes a different value at each live path.
const replacementsOf = perObject((_node: TscnNode) =>
  perObject((_texts: PropertyTexts) => new Map<string, TscnNode>())
);

function replacedAt(
  nodes: readonly TscnNode[],
  at: readonly number[],
  replace: (node: TscnNode) => TscnNode
): TscnNode[] {
  function replaced(node: TscnNode, depth: number): TscnNode {
    const index = at[depth];
    if (index === undefined) return replace(node);
    return parentWithChild(node, index, replaced(node.children[index]!, depth + 1));
  }
  const root = at[0]!;
  return replacing(nodes, root, replaced(nodes[root]!, 1));
}

/** The node's path from the root, as a heading's `parent` spells it. */
function rootRelativePath(roots: readonly TscnNode[], at: readonly number[]): string {
  const names: string[] = [];
  let nodes = roots;
  at.forEach((index, depth) => {
    const node = nodes[index]!;
    if (depth > 0) names.push(...seatOf(node));
    nodes = node.children;
  });
  return names.join('/');
}

/** `roots` with the writes at `livePath` laid where they land. */
function withWrite(roots: readonly TscnNode[], livePath: string, texts: PropertyTexts): readonly TscnNode[] {
  const landing = landingOf(roots, livePath);
  if (!landing) return roots;
  return replacedAt(roots, landing.at, (node) => {
    const held = replacementsOf(node)(texts);
    const previous = held.get(livePath);
    if (previous) return previous;
    const written =
      landing.kind === 'node'
        ? laid(node, texts)
        : withOverride(node, rootRelativePath(roots, landing.at), landing, texts);
    held.set(livePath, written);
    return written;
  });
}

function withOverride(
  instance: TscnNode,
  instancePath: string,
  landing: Extract<Landing, { kind: 'override' }>,
  texts: PropertyTexts
): TscnNode {
  const existing = instance.children.findIndex(
    (child) => child.name === landing.name && (child.instanceSubPath ?? '') === landing.subPath
  );
  const children =
    existing >= 0
      ? replacing(instance.children, existing, laid(instance.children[existing]!, texts))
      : [...instance.children, overrideHeading(instancePath, landing.subPath, landing.name, texts)];
  return { ...instance, children };
}

function rootNodesOf(graph: SceneGraph): readonly TscnNode[] {
  return graph.scenes.get(graph.rootScene)?.nodes ?? [];
}

/** The roots with every write laid, seated as `roots` are, and seated so again after a reseat. */
function writtenRoots(roots: readonly TscnNode[], writes: SceneWrites): readonly TscnNode[] {
  let nodes = roots;
  for (const [livePath, texts] of writes) nodes = withWrite(nodes, livePath, texts);
  return shareSeating(nodes, roots, (reseated) => writtenRoots(reseated, writes));
}

const withResources = perObject((file: readonly TscnExternalResource[]) =>
  perObject((extra: readonly TscnExternalResource[]) => [...file, ...extra])
);

/** The exact writes a published graph draws. A new parse starts with no writes. */
// eslint-disable-next-line no-restricted-syntax -- writtenSceneGraph publishes its input beside the graph for readers of repeated setters
const writesByGraph = new WeakMap<SceneGraph, SceneWrites>();

/** How many times the setter at this path has run in the snapshot, including equal writes. */
export function propertyWriteRevision(graph: SceneGraph | null, path: string, property: string): number {
  return writeRevision(graph ? writesByGraph.get(graph)?.get(path) : undefined, property);
}

/** Each node off a written path keeps its identity. */
export function writtenSceneGraph(
  graph: SceneGraph,
  writes: SceneWrites,
  resources: readonly TscnExternalResource[]
): SceneGraph {
  const root = graph.scenes.get(graph.rootScene);
  if (!root || (writes.size === 0 && resources.length === 0)) return graph;
  const scene: ParsedScene = {
    ...root,
    nodes: writtenRoots(root.nodes, writes),
    externalResources:
      resources.length === 0 ? root.externalResources : withResources(root.externalResources)(resources),
  };
  const written = buildSceneGraph(scene);
  writesByGraph.set(written, writes);
  return written;
}
