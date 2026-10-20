/**
 * The base components a slice mounts while it draws nothing of its own: they place the node's
 * transform for its children, and nothing else. `NodeComponentRegistry` holds a declared render
 * intent to this.
 */

import type { NodeComponent } from './NodeComponentRegistry';

/** Written only by `invisibleBase`, once for each base component it marks. Never cleared. */
const invisibleBases = new WeakSet<NodeComponent>();

/** Marks `component` as a base that draws nothing, and returns it. */
export function invisibleBase<C extends NodeComponent>(component: C): C {
  invisibleBases.add(component);
  return component;
}

export function isInvisibleBase(component: NodeComponent): boolean {
  return invisibleBases.has(component);
}
