import type { SceneGraph } from '../core/SceneGraph.js';
import type { PropertyTexts, SceneWrites } from './sceneWrites.js';

/** Written by recordPropertyWrites. Old revisions leave with the immutable texts of their snapshot. */
// eslint-disable-next-line no-restricted-syntax -- a write supplies the revisions, which cannot be derived from equal texts
const revisions = new WeakMap<PropertyTexts, ReadonlyMap<string, number>>();

/** The exact writes a published graph draws. A new parse starts with no writes. */
// eslint-disable-next-line no-restricted-syntax -- writtenSceneGraph publishes its input beside the graph for readers of repeated setters
const writesByGraph = new WeakMap<SceneGraph, SceneWrites>();

export function recordGraphWrites(graph: SceneGraph, writes: SceneWrites): void {
  writesByGraph.set(graph, writes);
}

/** How many times the setter at this path has run in the snapshot, including equal writes. */
export function propertyWriteRevision(graph: SceneGraph | null, path: string, property: string): number {
  const texts = graph && writesByGraph.get(graph)?.get(path);
  return (texts && revisions.get(texts)?.get(property)) ?? 0;
}

/** Keeps the latest setter revision beside its texts, so a repeated setter can arm a spent viewport mode. */
export function recordPropertyWrites(
  previous: PropertyTexts | undefined,
  laid: PropertyTexts,
  written: readonly (readonly [property: string, text: string])[]
): void {
  const latest = new Map(previous && revisions.get(previous));
  for (const [property] of written) latest.set(property, (latest.get(property) ?? 0) + 1);
  revisions.set(laid, latest);
}
