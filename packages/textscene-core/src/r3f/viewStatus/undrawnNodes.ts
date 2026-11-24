import { CountedReports } from '../../utils/countedReports.js';
import { absolutePathOf } from '../../scene/nodePathWalk.js';

/** What the view holds of one node and does not draw as authored. */
export interface UndrawnNode {
  /** The absolute node path, as a node handle's `path` gives it: `/root/Main/Sign`. */
  path: string;
  /** The mesh types the node holds that the view does not draw, in name order. */
  meshTypes: readonly string[];
  /** `CSGShape3D::get_configuration_warnings` (csg_shape.cpp:982): the shape's brush is empty. */
  isEmptyShape: boolean;
  /** The error text of each failed shader of the node, in text order: the view draws Godot's fallback. */
  shaderErrors: readonly string[];
}

/** The entry of the node at the live path `livePath`, or null. */
export function undrawnNodeAt(undrawn: readonly UndrawnNode[], livePath: string): UndrawnNode | null {
  const path = absolutePathOf(livePath);
  return undrawn.find((node) => node.path === path) ?? null;
}

/** Why a node is undrawn: a mesh of a type the view does not draw, an empty CSG shape, or a shader error. */
export type UndrawnReason = { meshType: string } | 'empty-shape' | { shaderError: string };

const EMPTY_SHAPE_TAG = 'e';
const MESH_TYPE_TAG = 'm';
const SHADER_ERROR_TAG = 's';

// A newline never occurs in a node path, so the first one splits the path from the tagged reason.
function keyOf(path: string, reason: UndrawnReason): string {
  if (reason === 'empty-shape') return `${path}\n${EMPTY_SHAPE_TAG}`;
  if ('meshType' in reason) return `${path}\n${MESH_TYPE_TAG}${reason.meshType}`;
  return `${path}\n${SHADER_ERROR_TAG}${reason.shaderError}`;
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
  const byPath = new Map<string, { meshTypes: string[]; isEmptyShape: boolean; shaderErrors: string[] }>();
  for (const key of keys) {
    const split = key.indexOf('\n');
    const path = key.slice(0, split);
    const tag = key[split + 1];
    const text = key.slice(split + 2);
    const node = byPath.get(path) ?? { meshTypes: [], isEmptyShape: false, shaderErrors: [] };
    if (tag === MESH_TYPE_TAG) node.meshTypes.push(text);
    else if (tag === SHADER_ERROR_TAG) node.shaderErrors.push(text);
    else node.isEmptyShape = true;
    byPath.set(path, node);
  }
  return [...byPath]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, { meshTypes, isEmptyShape, shaderErrors }]) => ({
      path: absolutePathOf(path),
      meshTypes: meshTypes.sort(),
      isEmptyShape,
      shaderErrors: shaderErrors.sort(),
    }));
}
