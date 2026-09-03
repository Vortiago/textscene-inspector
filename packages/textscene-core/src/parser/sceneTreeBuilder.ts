/**
 * Builds hierarchical scene tree from flat TSCN node list.
 */

import type { NodeOrigin, TscnNode } from './types';
import { ROOT_PARENT_PATH } from '../godot';

/**
 * Build scene tree from flat node list using parent path references.
 * Parent paths in TSCN are relative to root: "." = root, "Foo/Bar" = root/Foo/Bar
 */
export function buildSceneTree(nodes: TscnNode[]): TscnNode[] {
  if (nodes.length === 0) return [];

  // Heading 0 is the root when nothing declares itself parentless: `packed_scene.cpp:218-219`
  // makes `i == 0` the root and fails the instantiate outright when it names a
  // parent, so there is no reading under which the later headings are roots too.
  // Handing the flat list back as roots made every node reachable, which is the
  // set `strandedNodes` derives its answer from — the report went silent on
  // exactly the file the engine refuses.
  const rootNode = nodes.find((n) => !n.parent) ?? nodes[0]!;

  // Map from relative path to node (paths don't include root name)
  const pathMap = new Map<string, TscnNode>();
  pathMap.set('', rootNode); // Root is at empty path

  // Track remaining nodes to place
  let remaining = placeResolvable(nodes.filter((n) => n !== rootNode), rootNode, pathMap);

  // A node whose parent path descends INTO instanced content can never resolve
  // here: the intermediate names live in the instanced scene or GLB, not in
  // this file. Godot only lets you address into a sub-scene you INSTANCED, so
  // the nearest enclosing instance node is the anchor, and the rest of the path
  // is that content's business to match.
  //
  // Requiring the anchor to be instance-bearing is what separates these from
  // genuinely malformed paths: a scene that says `parent="Level2"` when the
  // root has no such child is a mistake, and re-rooting it under the nearest
  // resolvable ancestor would hide it. Godot re-roots such a node to the SCENE
  // root and renames it `Level2#Name` (`packed_scene.cpp:208-215`, `:561-563`);
  // `strandedNodes` below is what carries the same fact to a caller, since a
  // node absent from the tree is otherwise invisible to everything walking it.
  // It is also the ONLY report. Logging `remaining` from here covers the
  // narrower set — a second parentless heading never reaches it — so the console
  // would say nothing about a node the linter names.
  //
  // One node is deferred per pass, then the ordinary resolution above is
  // re-run, so a deferred node's own descendants resolve through their declared
  // paths and never pick up a marker of their own.
  while (remaining.length > 0) {
    const deferred = firstAnchorable(remaining, pathMap);
    if (!deferred) break;

    const { node, anchor } = deferred;
    anchor.node.children.push(node);
    node.instanceSubPath = anchor.subPath;
    pathMap.set(`${node.parent}/${node.name}`, node);

    remaining = placeResolvable(
      remaining.filter((n) => n !== node),
      rootNode,
      pathMap
    );
  }

  return [rootNode];
}

/**
 * Attach every node whose parent path resolves against `pathMap`, repeating
 * until a pass places nothing.
 *
 * Iterates FORWARD (declaration order) and rebuilds the unplaced list each pass
 * — this preserves sibling order, so `children` matches the `.tscn` declaration
 * order, which is the 2D paint order (earlier siblings draw behind), and it
 * avoids the index-shifting hazards of splicing mid-iteration. Repeating places
 * children whose parent appears later in the file.
 *
 * Returns the nodes that still did not resolve.
 */
function placeResolvable(
  nodes: TscnNode[],
  rootNode: TscnNode,
  pathMap: Map<string, TscnNode>
): TscnNode[] {
  let remaining = nodes;
  let lastRemainingCount = remaining.length + 1;

  while (remaining.length > 0 && remaining.length < lastRemainingCount) {
    lastRemainingCount = remaining.length;
    const stillRemaining: TscnNode[] = [];

    for (const node of remaining) {
      if (!node.parent) {
        // A second parentless node cannot be placed by path, so it never
        // reaches `remaining` — `strandedNodes` finds it by walking the tree
        // this returns, which is why that derivation is not a second copy of
        // the resolution rules.
        continue;
      }

      // The root's own spelling means a direct child of root; otherwise
      // resolve by parent path.
      const parentNode =
        node.parent === ROOT_PARENT_PATH ? rootNode : pathMap.get(node.parent);
      if (parentNode) {
        parentNode.children.push(node);
        const nodePath =
          node.parent === ROOT_PARENT_PATH ? node.name : `${node.parent}/${node.name}`;
        pathMap.set(nodePath, node);
      } else {
        stillRemaining.push(node);
      }
    }

    remaining = stillRemaining;
  }

  return remaining;
}

/** The first node that has an instance anchor, paired with that anchor. */
function firstAnchorable(
  remaining: readonly TscnNode[],
  pathMap: Map<string, TscnNode>
): { node: TscnNode; anchor: { node: TscnNode; subPath: string } } | null {
  for (const node of remaining) {
    const anchor = findInstanceAnchor(node, pathMap);
    if (anchor) return { node, anchor };
  }
  return null;
}

/**
 * The nearest INSTANCE node enclosing this node's parent path, and the
 * remainder of that path below it — or `null` when the path names no instanced
 * content, which makes it a malformed path rather than an override.
 *
 * Prefixes are walked longest-first so nested instances anchor at the innermost
 * one: the sub-path has to be measured from the scene that will actually
 * resolve it.
 */
function findInstanceAnchor(
  node: TscnNode,
  pathMap: Map<string, TscnNode>
): { node: TscnNode; subPath: string } | null {
  if (!node.parent || node.parent === ROOT_PARENT_PATH) return null;

  const segments = node.parent.split('/');
  // Start one short of the full path: had the whole thing resolved, ordinary
  // placement would already have used it.
  for (let depth = segments.length - 1; depth >= 0; depth--) {
    const candidate = pathMap.get(segments.slice(0, depth).join('/'));
    if (candidate?.instance) {
      return { node: candidate, subPath: segments.slice(depth).join('/') };
    }
  }
  return null;
}

/**
 * The entries {@link buildSceneTree} could not place, out of every node the
 * scan produced.
 *
 * Derived from the tree it actually returned rather than re-deciding
 * resolvability: the deferral pass anchors a path descending into instanced
 * content, and a second copy of that judgement would drift from this one. A
 * node reachable from `roots` was placed; every other node was not.
 *
 * Two shapes end up here. One declares a `parent=` path that names nothing —
 * Godot warns and re-roots it. One declares no `parent=` at all while not being
 * the root, which `packed_scene.cpp:206` refuses outright.
 */
export function strandedNodes(
  all: readonly NodeOrigin[],
  roots: readonly TscnNode[]
): NodeOrigin[] {
  const placed = new Set<TscnNode>();
  const walk = (nodes: readonly TscnNode[]): void => {
    for (const node of nodes) {
      if (placed.has(node)) continue;
      placed.add(node);
      walk(node.children);
    }
  };
  walk(roots);
  // Every node arrives with its line already attached rather than being looked
  // up here: a lookup needs a fallback, and there is no honest one — a
  // diagnostic pointing at line 0 reads as a real location in an editor gutter.
  return all.filter(({ node }) => !placed.has(node));
}

/**
 * The FIRST heading, when it declares a `parent=`.
 *
 * `packed_scene.cpp:219` refuses exactly that — "root node %s cannot specify a
 * parent node" — so the file loads and no scene can be built from it.
 *
 * Positional, unlike {@link strandedNodes}, and deliberately not "the heading
 * that became our root": the engine's root is `i == 0` and nothing else, while
 * `buildSceneTree` above prefers a parentless heading wherever it sits. Given
 * `[node name="A" parent="."]` followed by a parentless `Root`, the two answer
 * differently — the builder roots at `Root` and seats `A` beneath it, and only
 * the positional reading still names the heading Godot refuses.
 *
 * The test is the DECLARED attribute, not `node.parent`: both parsers leave the
 * latter unset for `parent=""`, and `add_node_path` returns an index for any
 * value the field carries (`packed_scene.cpp:2307-2311`), so an empty one still
 * reaches the refusal.
 */
export function rootDeclaringParent(all: readonly NodeOrigin[]): NodeOrigin | undefined {
  const first = all[0];
  return first?.declaredParent === undefined ? undefined : first;
}
