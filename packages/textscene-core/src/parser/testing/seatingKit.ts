/**
 * Shared test kit for the seating tests: the `node` heading factory, the `originsOf` scan of a
 * node list and `withOrigin`. Build-excluded through the `src/**\/testing/**` tsconfig rule.
 */

import type { NodeOrigin, TscnNode } from '../types';

/** A childless `Node3D`, a root when `parent` is absent. `extras` merge over it. */
export function node(name: string, parent?: string, extras: Partial<TscnNode> = {}): TscnNode {
  const heading: TscnNode = {
    rawProperties: {},
    type: 'Node3D',
    name,
    properties: {},
    children: [],
    ...extras,
  };
  return parent === undefined ? heading : { ...heading, parent };
}

/** One origin per node, in order, each declaring the `parent=` its node carries and the `unique_id=` its name has in `uniqueIds`. */
export function originsOf(nodes: TscnNode[], uniqueIds: Record<string, number> = {}): NodeOrigin<TscnNode>[] {
  return nodes.map((heading, i) => ({
    node: heading,
    line: i + 1,
    declaredParent: heading.parent,
    uniqueId: uniqueIds[heading.name] ?? 0,
  }));
}

/** `origins` with `patch` applied to the one at `index`. */
export function withOrigin(
  origins: NodeOrigin<TscnNode>[],
  index: number,
  patch: Partial<NodeOrigin<TscnNode>>
): NodeOrigin<TscnNode>[] {
  return origins.map((origin, i) => (i === index ? { ...origin, ...patch } : origin));
}
