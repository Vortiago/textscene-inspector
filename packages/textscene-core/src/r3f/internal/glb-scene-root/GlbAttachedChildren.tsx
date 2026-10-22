/**
 * Renders the typed nodes an instancing scene adds inside a GLB, each under the GLB object its
 * parent path names. Godot adds such a node to the node that path resolves to
 * (`packed_scene.cpp:157-165`, `:541`), so it takes that object's transform and visibility.
 */
import { useMemo, type ReactNode } from 'react';
import type * as THREE from 'three';
import type { LiveNode } from '../../../resources/liveNode';
import { joinPath } from '../../../utils/nodePath';
import { DispatchedNode } from '../../NodeDispatcher';
import { AttachedToObject, ParentTypeProvider } from '../../parentSpaceScope';
import { CullPathProvider } from '../../visibilityRange/CullPathContext';
import { VisibilityParentProvider } from '../../visibilityRange/VisibilityParentContext';
import { useUniqueNamePaths } from '../../useUniqueNames';
import {
  childOrders,
  TreeOrderProvider,
  useTreeOrder,
  type TreeOrder,
} from '../../contexts/TreeOrderContext';
import type { GlbRoot } from './GlbInstanceContext';
import type { GlbObjectEntry } from './glbHierarchy';
import { glbNodeLinks } from './glbNodeLinks';
import { isApplicableGlbOverride } from './glbNodeOverrides';
import { matchGlbTarget } from './matchGlbTarget';

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
  /** The mounted GLB, the root of `entries`. */
  object: THREE.Object3D;
  /** The mounted GLB flattened by `flattenGlbObjects`, which `root.overrides` address into. */
  entries: readonly GlbObjectEntry[];
  root: GlbRoot;
  /** The GLB scene root's own node path, which each GLB object's `relPath` continues. */
  nodePath: string | null;
}

export function GlbAttachedChildren({
  object,
  entries,
  root,
  nodePath,
}: GlbAttachedChildrenProps): ReactNode {
  const rootOrder = useTreeOrder();
  const uniquePaths = useUniqueNamePaths(root.path);
  const attached = useMemo(
    () => attachedChildren(object, entries, root, nodePath, rootOrder, uniquePaths),
    [object, entries, root, nodePath, rootOrder, uniquePaths]
  );
  if (nodePath === null || root.path === null) return null;
  const godotPath = root.path;
  return attached.map(({ node, path, target, order, visibilityParent }) => (
    <AttachedToObject key={path} target={target}>
      <ParentTypeProvider value={GLB_OBJECT_TYPE}>
        <VisibilityParentProvider value={visibilityParent}>
          <CullPathProvider selection={nodePath} godot={godotPath}>
            <TreeOrderProvider order={order}>
              <DispatchedNode node={node} path={path} />
            </TreeOrderProvider>
          </CullPathProvider>
        </VisibilityParentProvider>
      </ParentTypeProvider>
    </AttachedToObject>
  ));
}

/**
 * Each typed node of `overrides` with the GLB object its parent path resolves to, in authored
 * order. A path that names no object drops its node, and `matchGlbTarget` warns once for it.
 */
function attachedChildren(
  object: THREE.Object3D,
  entries: readonly GlbObjectEntry[],
  root: GlbRoot,
  nodePath: string | null,
  rootOrder: TreeOrder,
  uniquePaths: ReadonlyMap<string, string> | undefined
): AttachedChild[] {
  // The common GLB has none, so nothing below runs for it. A GLB opened as the scene has no
  // instancing node to address into it.
  if (nodePath === null || root.path === null || root.overrides.every(isApplicableGlbOverride)) return [];
  const orders = childOrders(rootOrder, entries.length);
  const links = glbNodeLinks(object, entries, root, uniquePaths);
  const attachedBelow = new Map<number, number>();
  const attached: AttachedChild[] = [];
  for (const node of root.overrides) {
    if (isApplicableGlbOverride(node)) continue;
    const target = matchGlbTarget(entries, node.instanceSubPath!);
    if (!target) continue;
    // After the target's whole subtree, in the flat order its entries hold, and after the nodes
    // already attached there.
    const targetIndex = entries.indexOf(target);
    const afterSubtree = lastDescendantIndex(entries, targetIndex);
    const siblings = attachedBelow.get(afterSubtree) ?? 0;
    attachedBelow.set(afterSubtree, siblings + 1);
    attached.push({
      node,
      path: joinPath(joinPath(nodePath, target.relPath), node.name),
      target: target.object,
      order: [...orders[afterSubtree]!, siblings],
      visibilityParent: links[targetIndex]!.place.parentPath,
    });
  }
  return attached;
}

/** The index of the last entry at or below the one at `index`, which `flattenGlbObjects` lists in pre-order. */
function lastDescendantIndex(entries: readonly GlbObjectEntry[], index: number): number {
  const prefix = `${entries[index]!.relPath}/`;
  let last = index;
  while (entries[last + 1]?.relPath.startsWith(prefix)) last++;
  return last;
}
