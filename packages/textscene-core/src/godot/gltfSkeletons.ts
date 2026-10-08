/**
 * Which glTF nodes Godot 4.6.3's importer turns into bones: a port of `SkinTool`'s skin expansion
 * and skeleton grouping (`modules/gltf/skin_tool.cpp`). A bone is no node in the imported scene, so
 * it takes no node name. Each step keeps Godot's iteration order, as its quirks depend on it.
 */

/** A glTF node as `GLTFNode` holds it while the importer builds skeletons. -1 means none. */
export interface ImportNode {
  readonly children: readonly number[];
  readonly parent: number;
  /** Ancestors above the node (`gltf_document.cpp:654-678`). */
  readonly height: number;
  readonly mesh: number;
  readonly skin: number;
  /** Set for each skin joint (`gltf_document.cpp:3281`), and for each node a skeleton absorbs. */
  joint: boolean;
}

/** A skin's joints in file order, and the nodes its expansion captured, each in the order added. */
interface ImportSkin {
  readonly joints: Set<number>;
  readonly nonJoints: Set<number>;
  roots: number[];
}

/**
 * Godot's `DisjointSet` (`core/math/disjoint_set.h`). Its `HashMap` iterates in insertion order,
 * and so does a `Map`, so representatives and members come out in Godot's order.
 */
class DisjointSet {
  private readonly parents = new Map<number, number>();
  private readonly ranks = new Map<number, number>();

  insert(node: number): void {
    if (this.parents.has(node)) return;
    this.parents.set(node, node);
    this.ranks.set(node, 0);
  }

  union(a: number, b: number): void {
    this.insert(a);
    this.insert(b);
    let aRoot = this.root(a);
    let bRoot = this.root(b);
    if (aRoot === bRoot) return;
    if (this.ranks.get(aRoot)! < this.ranks.get(bRoot)!) [aRoot, bRoot] = [bRoot, aRoot];
    this.parents.set(bRoot, aRoot);
    if (this.ranks.get(aRoot) === this.ranks.get(bRoot)) this.ranks.set(aRoot, this.ranks.get(aRoot)! + 1);
  }

  representatives(): number[] {
    return [...this.parents].filter(([node, parent]) => node === parent).map(([node]) => node);
  }

  /** Each set's members in insertion order, the sets in their representatives' order. */
  groups(): number[][] {
    const byRoot = new Map(this.representatives().map((node): [number, number[]] => [node, []]));
    for (const node of this.parents.keys()) byRoot.get(this.root(node))!.push(node);
    return [...byRoot.values()];
  }

  private root(node: number): number {
    const parent = this.parents.get(node)!;
    if (parent === node) return node;
    const root = this.root(parent);
    this.parents.set(node, root);
    return root;
  }
}

/** The disjoint set of `nodes` joined along parent links inside it. */
function treesOf(nodes: readonly ImportNode[], members: Iterable<number>): DisjointSet {
  const set = new DisjointSet();
  const memberSet = new Set(members);
  for (const node of memberSet) {
    set.insert(node);
    const parent = nodes[node]!.parent;
    if (memberSet.has(parent)) set.union(parent, node);
  }
  return set;
}

/** `_find_highest_node` (`skin_tool.cpp:33-48`): the least height, the first on a tie. */
function highestNode(nodes: readonly ImportNode[], subset: readonly number[]): number {
  let best = -1;
  for (const node of subset) {
    if (best === -1 || nodes[node]!.height < nodes[best]!.height) best = node;
  }
  return best;
}

/** Adds `node` to the skin's joints when it is a joint not yet there, else to its non-joints. */
function captureAncestor(nodes: readonly ImportNode[], skin: ImportSkin, node: number): void {
  if (nodes[node]!.joint && !skin.joints.has(node)) skin.joints.add(node);
  else skin.nonJoints.add(node);
}

/**
 * `_capture_nodes_in_skin` (`skin_tool.cpp:50-72`). Godot tests `joints.find(node) > 0`, so the
 * skin's first joint reports no joint below its parent.
 */
function captureNodesInSkin(nodes: readonly ImportNode[], skin: ImportSkin, node: number): boolean {
  let hasJointBelow = false;
  for (const child of nodes[node]!.children) {
    hasJointBelow = captureNodesInSkin(nodes, skin, child) || hasJointBelow;
  }
  if (hasJointBelow) captureAncestor(nodes, skin, node);
  return skin.joints.has(node) && node !== skin.joints.values().next().value;
}

/** `_capture_nodes_for_multirooted_skin` (`skin_tool.cpp:74-152`). */
function captureNodesForMultirootedSkin(nodes: readonly ImportNode[], skin: ImportSkin): void {
  const roots = treesOf(nodes, skin.joints).representatives();
  if (roots.length <= 1) return;

  // Godot names this the max height, but it keeps the least.
  let level = -1;
  for (const root of roots) {
    if (level === -1 || nodes[root]!.height < level) level = nodes[root]!.height;
  }
  for (let i = 0; i < roots.length; i++) {
    let current = roots[i]!;
    while (nodes[current]!.height > level) {
      current = nodes[current]!.parent;
      captureAncestor(nodes, skin, current);
    }
    roots[i] = current;
  }

  while (!roots.every((root) => nodes[root]!.parent === nodes[roots[0]!]!.parent)) {
    for (let i = 0; i < roots.length; i++) {
      const parent = nodes[roots[i]!]!.parent;
      captureAncestor(nodes, skin, parent);
      roots[i] = parent;
    }
  }
}

/** `_expand_skin` (`skin_tool.cpp:154-197`). */
function expandSkin(nodes: readonly ImportNode[], skin: ImportSkin): void {
  captureNodesForMultirootedSkin(nodes, skin);
  const trees = treesOf(nodes, [...skin.joints, ...skin.nonJoints]);
  const roots = trees.groups().map((group) => highestNode(nodes, group));
  roots.sort((a, b) => a - b);
  for (const root of roots) captureNodesInSkin(nodes, skin, root);
  skin.roots = roots;
}

/** `_recurse_children` (`skin_tool.cpp:264-283`): the subtree, less each leaf skinned mesh. */
function addSubtree(
  nodes: readonly ImportNode[],
  node: number,
  into: Set<number>,
  visited: Set<number>
): void {
  if (visited.has(node)) return;
  visited.add(node);
  const current = nodes[node]!;
  for (const child of current.children) addSubtree(nodes, child, into, visited);
  if (current.skin < 0 || current.mesh < 0 || current.children.length > 0) into.add(node);
}

/** `_check_if_parent_needs_to_become_joint` (`skin_tool.cpp:285-294`). */
function captureNonJointAncestors(
  nodes: readonly ImportNode[],
  skeletonNodes: ReadonlySet<number>,
  node: number,
  nonJoints: Set<number>
): void {
  const parent = nodes[node]!.parent;
  if (parent < 0) return;
  if (nodes[parent]!.joint || !skeletonNodes.has(parent) || nonJoints.has(parent)) return;
  captureNonJointAncestors(nodes, skeletonNodes, parent, nonJoints);
  nonJoints.add(parent);
}

/** The skin groups of `_determine_skeletons` (`skin_tool.cpp:296-404`), merged into skeletons. */
function skeletonSets(nodes: readonly ImportNode[], skins: readonly ImportSkin[]): DisjointSet {
  const sets = new DisjointSet();
  for (const skin of skins) {
    const visited = new Set<number>();
    const skinNodes = new Set<number>();
    for (const node of [...skin.joints, ...skin.nonJoints]) {
      skinNodes.add(node);
      addSubtree(nodes, node, skinNodes, visited);
    }
    // An `RBSet`, so Godot visits the nodes in ascending order.
    for (const node of [...skinNodes].sort((a, b) => a - b)) {
      sets.insert(node);
      const parent = nodes[node]!.parent;
      if (skinNodes.has(parent)) sets.union(parent, node);
    }
    for (const root of skin.roots.slice(1)) sets.union(skin.roots[0]!, root);
  }

  const groups = sets.groups();
  const highest = groups.map((group) => highestNode(nodes, group));
  const groupOf = new Map(groups.flatMap((group, i) => group.map((node): [number, number] => [node, i])));
  for (let i = 0; i < highest.length; i++) {
    const node = highest[i]!;
    for (let j = i + 1; j < highest.length; j++) {
      if (nodes[node]!.parent === nodes[highest[j]!]!.parent) sets.union(node, highest[j]!);
    }
    const parent = nodes[node]!.parent;
    if (parent < 0) continue;
    // Godot's loop condition stops at `j === i`, so only the groups before this one join it.
    const j = groupOf.get(parent);
    if (j !== undefined && j < i) sets.union(node, highest[j]!);
  }
  return sets;
}

/**
 * The bones of one skeleton (`skin_tool.cpp:405-437`). `_reparent_non_joint_skeleton_subtrees`
 * (`:457-502`) makes every collected non-joint a joint, as each lies in one of its subtrees.
 */
function skeletonJoints(
  nodes: readonly ImportNode[],
  skeletonNodes: readonly number[],
  turnNonJointDescendantsIntoBones: boolean
): number[] {
  const members = new Set(skeletonNodes);
  const joints: number[] = [];
  const nonJoints = new Set<number>();
  for (const node of skeletonNodes) {
    if (nodes[node]!.joint) {
      if (!turnNonJointDescendantsIntoBones) captureNonJointAncestors(nodes, members, node, nonJoints);
      joints.push(node);
    } else if (turnNonJointDescendantsIntoBones) {
      nonJoints.add(node);
    }
  }
  for (const node of nonJoints) nodes[node]!.joint = true;
  return [...joints, ...nonJoints];
}

function importSkin(joints: readonly number[]): ImportSkin {
  return { joints: new Set(joints), nonJoints: new Set(), roots: [] };
}

/**
 * The nodes the importer makes bones, from `_parse_skins` (`gltf_document.cpp:3249-3309`) and
 * `_determine_skeletons`. `singleSkeletonRoots` is `nodes/import_as_skeleton_bones`'s skin of the
 * scene roots, empty without it. Marks `joint` on `nodes` as Godot does.
 */
export function gltfBoneNodes(
  nodes: readonly ImportNode[],
  skinJoints: readonly (readonly number[])[],
  singleSkeletonRoots: readonly number[],
  turnNonJointDescendantsIntoBones: boolean
): Set<number> {
  const skins = skinJoints.map(importSkin);
  for (const joints of skinJoints) for (const joint of joints) nodes[joint]!.joint = true;
  for (const skin of skins) expandSkin(nodes, skin);
  if (singleSkeletonRoots.length > 0) skins.push(importSkin(singleSkeletonRoots));

  const sets = skeletonSets(nodes, skins);
  const bones = new Set<number>();
  for (const group of sets.groups()) {
    for (const bone of skeletonJoints(nodes, group, turnNonJointDescendantsIntoBones)) {
      bones.add(bone);
    }
  }
  return bones;
}
