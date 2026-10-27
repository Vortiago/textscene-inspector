/**
 * Renders the typed nodes an instancing scene adds inside a GLB, each under the GLB object its
 * parent path names. Godot adds such a node to the node that path resolves to, then moves it to its
 * `index=` among that node's children (`packed_scene.cpp:157-165`, `:540-545`), so it takes that
 * object's transform and visibility, and that place in tree order. The instancing node's scene
 * authored it, so it sits at that scene's level, not the GLB's.
 */
import { useMemo, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { LiveNode } from '../../../resources/liveNode';
import { joinPath } from '../../../utils/nodePath';
import { InstancedScenePathsProvider } from '../../contexts/InstancedScenePathsContext';
import { DispatchedNode } from '../../NodeDispatcher';
import { AttachedToObject, ParentTypeProvider } from '../../parentSpaceScope';
import { VisibilityParentProvider } from '../../visibilityRange/VisibilityParentContext';
import {
  childOrders,
  TreeOrderProvider,
  useTreeOrder,
  type TreeOrder,
} from '../../contexts/TreeOrderContext';
import type { GlbRoot } from './GlbInstanceContext';
import { glbChildrenBelow, type GlbObjectEntry } from './glbHierarchy';
import type { GlbNodeLink } from './glbNodeLinks';
import { isApplicableGlbOverride, resolveGlbAttachments, type GlbAttachment } from './glbNodeOverrides';
import { warn } from '../../../logger';

/** A GLB object is a Node3D in Godot, so a child of another family escapes it as it escapes a Node3D. */
const GLB_OBJECT_TYPE = 'Node3D';

interface AttachedChild {
  node: LiveNode;
  /** The path the tree shows the node at, and its object registers under: below its GLB parent's. */
  path: string;
  target: THREE.Object3D;
  order: TreeOrder;
  /** The visibility parent the target passes on (`node_3d.cpp:1307-1318`), or null for none. */
  visibilityParent: string | null;
}

interface GlbAttachedChildrenProps {
  /**
   * The mounted GLB's objects as `glbNodeLinks` reads them, one link per `flattenGlbObjects`
   * entry, which `root.overrides` address into.
   */
  links: readonly GlbNodeLink[];
  root: GlbRoot;
}

export function GlbAttachedChildren({ links, root }: GlbAttachedChildrenProps): ReactNode {
  const rootOrder = useTreeOrder();
  const attached = useMemo(() => attachedChildren(links, root, rootOrder), [links, root, rootOrder]);
  return attached.map(({ node, path, target, order, visibilityParent }) => (
    <AttachedToObject key={path} target={target}>
      <ParentTypeProvider value={GLB_OBJECT_TYPE}>
        <VisibilityParentProvider value={visibilityParent}>
          <TreeOrderProvider order={order}>
            <InstancedScenePathsProvider paths={root.hostScenePaths}>
              <DispatchedNode node={node} path={path} />
            </InstancedScenePathsProvider>
          </TreeOrderProvider>
        </VisibilityParentProvider>
      </ParentTypeProvider>
    </AttachedToObject>
  ));
}

/**
 * Each typed node of `overrides` with the GLB object its parent path resolves to, in authored
 * order. A path that names no object drops its node, with a warning.
 */
function attachedChildren(
  links: readonly GlbNodeLink[],
  root: GlbRoot,
  rootOrder: TreeOrder
): AttachedChild[] {
  // The common GLB has none, so nothing below runs for it. A GLB opened as the scene has no
  // instancing node to address into it.
  if (root.path === null || root.overrides.every(isApplicableGlbOverride)) return [];
  const rootPath = root.path;
  const entries = links.map((link) => link.entry);
  const { attached: placed, rest } = resolveGlbAttachments(entries, root.overrides);
  warnUnattached(rest);
  const orders = attachedOrders(entries, childOrders(rootOrder, entries.length), placed);
  return placed.map(({ node, target, host }) => ({
    node,
    path: joinPath(joinPath(rootPath, entries[target]!.relPath), node.name),
    target: host,
    order: orders.get(node)!,
    visibilityParent: links[target]!.place.parentPath,
  }));
}

/** Warns for each typed node of `unattached`, whose parent path names no GLB object. */
function warnUnattached(unattached: readonly LiveNode[]): void {
  for (const node of unattached) {
    if (isApplicableGlbOverride(node)) continue;
    warn(
      `[GlbAttachedChildren] "${node.instanceSubPath}" matches nothing in the loaded GLB, so "${node.name}" is dropped`
    );
  }
}

/**
 * The tree order of each placed node, among its target's children as `glbChildrenBelow` leaves them.
 * `entryOrders` gives each GLB object its place by its pre-order index, so a node takes a place
 * just after the subtree of the sibling object before it, or just after the target when it is first.
 */
function attachedOrders(
  entries: readonly GlbObjectEntry[],
  entryOrders: readonly TreeOrder[],
  placed: readonly GlbAttachment[]
): Map<LiveNode, TreeOrder> {
  const orders = new Map<LiveNode, TreeOrder>();
  for (const [target, children] of glbChildrenBelow(entries, placed)) {
    let after = target;
    let sinceObject = 0;
    for (const child of children) {
      if ('entry' in child) {
        after = lastDescendantIndex(entries, child.entry);
        sinceObject = 0;
      } else {
        orders.set(child, [...entryOrders[after]!, sinceObject++]);
      }
    }
  }
  return orders;
}

/** The index of the last entry at or below the one at `index`, which `flattenGlbObjects` lists in pre-order. */
function lastDescendantIndex(entries: readonly GlbObjectEntry[], index: number): number {
  const prefix = `${entries[index]!.relPath}/`;
  let last = index;
  while (entries[last + 1]?.relPath.startsWith(prefix)) last++;
  return last;
}
