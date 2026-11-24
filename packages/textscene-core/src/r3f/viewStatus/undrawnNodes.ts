import { CountedReports } from '../../utils/countedReports.js';
import { absolutePathOf } from '../../scene/nodePathWalk.js';

/** What the view holds of one node and does not draw. */
export interface UndrawnNode {
  /** The absolute node path, as a node handle's `path` gives it: `/root/Main/Sign`. */
  path: string;
  /** The mesh types the node holds that the view does not draw, in name order. */
  meshTypes: readonly string[];
  /** `CSGShape3D::get_configuration_warnings` (csg_shape.cpp:982): the shape's brush is empty. */
  isEmptyShape: boolean;
  /** The view has no component for the node's type, so it draws nothing of the node's own. */
  hasNoComponent: boolean;
}

/** The entry of the node at the live path `livePath`, or null. */
export function undrawnNodeAt(undrawn: readonly UndrawnNode[], livePath: string): UndrawnNode | null {
  const path = absolutePathOf(livePath);
  return undrawn.find((node) => node.path === path) ?? null;
}

/** Why a node is undrawn: a mesh of a type the view does not draw, an empty CSG shape, or no component. */
export type UndrawnReason = { meshType: string } | 'empty-shape' | 'no-component';

// A newline never occurs in a node path, so it splits the path from the reason: `:` starts a mesh type.
function keyOf(path: string, reason: UndrawnReason): string {
  return `${path}\n${typeof reason === 'string' ? reason : `:${reason.meshType}`}`;
}

/** The undrawn nodes several reporters hold at once: a node stays while any report of it is open. */
export function createUndrawnNodes() {
  const reports = new CountedReports();
  let keys: ReadonlySet<string> | null = null;
  let nodes: readonly UndrawnNode[] = [];

  return {
    /** Opens one report of the node at the live path `path`. Returns its end, which runs once. */
    report(path: string, reason: UndrawnReason): () => void {
      const key = keyOf(path, reason);
      reports.report(key);
      let isEnded = false;
      return () => {
        if (isEnded) return;
        isEnded = true;
        reports.clear(key);
      };
    },
    /** One array while the reports hold, so a reader compares identities. */
    nodes(): readonly UndrawnNode[] {
      if (keys !== reports.keys()) {
        keys = reports.keys();
        nodes = nodesOf(keys);
      }
      return nodes;
    },
    subscribe: reports.subscribe,
  };
}

function nodesOf(keys: ReadonlySet<string>): UndrawnNode[] {
  const byPath = new Map<string, { meshTypes: string[]; isEmptyShape: boolean; hasNoComponent: boolean }>();
  for (const key of keys) {
    const split = key.indexOf('\n');
    const path = key.slice(0, split);
    const reason = key.slice(split + 1);
    const node = byPath.get(path) ?? { meshTypes: [], isEmptyShape: false, hasNoComponent: false };
    if (reason.startsWith(':')) node.meshTypes.push(reason.slice(1));
    else if (reason === 'empty-shape') node.isEmptyShape = true;
    else node.hasNoComponent = true;
    byPath.set(path, node);
  }
  return [...byPath]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, node]) => ({ path: absolutePathOf(path), ...node, meshTypes: node.meshTypes.sort() }));
}
