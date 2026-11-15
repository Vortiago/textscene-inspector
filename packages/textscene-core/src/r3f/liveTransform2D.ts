/**
 * The `Transform2D` of a Node2D of the Live scene tree, composed from the nodes on the way down to
 * it, so it holds across an instance border. The nodes are the ones the file stores. A pose that
 * something else wrote, such as a RemoteTransform2D or a solved bone, comes in as a patch.
 */

import type { RawNode, TscnNode } from '../parser/types.js';
import { parentLookup, type ParentLookup } from '../linter/parentType.js';
import {
  TRANSFORM2D_IDENTITY,
  multiplyTransform2D,
  type Transform2DColumns,
} from '../godot/math/transform2d.js';
import {
  localTransform2D,
  resolveGlobalTransform2D,
  type Node2DPose,
  NO_SOLVED,
  type SolvedControls,
} from '../nodes/canvasitem/shared/globalTransform2D.js';
import { NO_PATCHES, type PatchLookup } from './nodePatch.js';
import type { ControlLocalTransforms } from './contexts/YSortContext.js';

/** The nodes of `nodeByPath` that lie on `path`, root first. */
function chainTo(path: string, nodeByPath: ReadonlyMap<string, TscnNode>): TscnNode[] {
  const names = path.split('/');
  return names.flatMap((_, depth) => nodeByPath.get(names.slice(0, depth + 1).join('/')) ?? []);
}

/**
 * The parent lookup over a live chain, root first. A collapsed instance carries its
 * sub-scene root's type, so only an instance whose scene is not cached stays opaque.
 */
export function chainParentOf(chain: readonly RawNode[]): (child: RawNode) => ParentLookup {
  const parents = new Map(chain.slice(1).map((child, i): [RawNode, RawNode] => [child, chain[i]!]));
  return (child) => parentLookup(parents.get(child));
}

/** What `byPath` holds for each node of `chain`, which ends at the live path `path`, keyed by node. */
function lookupAlong<T>(
  chain: readonly RawNode[],
  path: string,
  byPath: { get(path: string): T | undefined }
): Map<RawNode, T> {
  const names = path.split('/');
  const found = new Map<RawNode, T>();
  let prefix = '';
  chain.forEach((node, index) => {
    prefix = index === 0 ? names[0]! : `${prefix}/${names[index]}`;
    const value = byPath.get(prefix);
    if (value) found.set(node, value);
  });
  return found;
}

/** The pose each node of `chain`, which ends at the live path `path`, takes from the patches in `placed`. */
export function posesAlong(
  chain: readonly RawNode[],
  path: string,
  placed: PatchLookup
): Map<RawNode, Node2DPose> {
  return lookupAlong(chain, path, placed as { get(path: string): Node2DPose | undefined });
}

/** The solved transform of each node of `chain`, which ends at the live path `path`, that `controlTransforms` holds. */
export function solvedControlsAlong(
  chain: readonly RawNode[],
  path: string,
  controlTransforms: ControlLocalTransforms | undefined
): SolvedControls {
  if (!controlTransforms || controlTransforms.size === 0) return NO_SOLVED;
  return lookupAlong(chain, path, controlTransforms);
}

/**
 * The transform of the node at `path` on the canvas, with the poses of `placed` in place of the
 * stored ones. `nodeByPath` holds the node at each prefix of `path`, as `nodesOnTheWayTo` makes it.
 * Null for a chain `resolveGlobalTransform2D` cannot decode: an opaque ancestor, or a Control that
 * neither `controlTransforms` nor the offsets of the file place.
 */
export function transform2DOnCanvas(
  path: string,
  nodeByPath: ReadonlyMap<string, TscnNode>,
  placed: PatchLookup = NO_PATCHES,
  controlTransforms?: ControlLocalTransforms
): Transform2DColumns | null {
  const chain = chainTo(path, nodeByPath);
  const verdict = resolveGlobalTransform2D(
    chain[chain.length - 1]!,
    chainParentOf(chain),
    posesAlong(chain, path, placed),
    solvedControlsAlong(chain, path, controlTransforms)
  );
  return verdict.kind === 'known' ? verdict.transform : null;
}

/**
 * The transform of the node at `path` within its ancestor at `ancestorPath`: the product of the
 * stored local transforms between the two, not a global one through an inverse, so a node keeps the
 * transform its file stores. A position the linter reports as malformed adds the identity.
 */
export function transform2DWithinPath(
  path: string,
  ancestorPath: string,
  nodeByPath: ReadonlyMap<string, TscnNode>,
  controlTransforms?: ControlLocalTransforms
): Transform2DColumns {
  const chain = chainTo(path, nodeByPath);
  const solved = solvedControlsAlong(chain, path, controlTransforms);
  const firstBelow = ancestorPath.split('/').length;
  return chain
    .slice(firstBelow)
    .reduce(
      (composed, node, index) =>
        multiplyTransform2D(
          composed,
          localTransform2D(node, undefined, chain[firstBelow + index - 1], solved) ?? TRANSFORM2D_IDENTITY
        ),
      TRANSFORM2D_IDENTITY
    );
}
