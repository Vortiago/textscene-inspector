/**
 * The Bone2D scene pass: what each Bone2D draws its kite from the live tree. Godot draws a kite to
 * each child it casts to Bone2D (`skeleton_2d.cpp:223-228`), and an instance of a scene whose root
 * is a Bone2D casts to one, so the pass reads the live tree, which collapses an instance into its
 * root (ADR-0060). It also ranks the kites in Godot's draw order.
 */

import type { LiveTree } from '../../../r3f/liveSceneTree.js';
import { perObject } from '../../../utils/perObject.js';
import { sameData } from '../../../utils/sameData.js';

/** What a Bone2D needs of the tree to draw its kite. */
export interface BoneKiteSource {
  /** The live paths of its Bone2D children, in order. */
  children: readonly string[];
  /**
   * Where its kite draws among all kites, from 0 up to but not including 1, later for a greater
   * value. Godot makes the gizmo item of a bone on its first draw, after the items of the bones below
   * it exist, and items of one z draw in tree order (`skeleton_2d.cpp:197-202`). So the order is the
   * post-order of the bones, as `rank / (rank + 1)`: that stays below 1 for any bone count, and
   * adding a bone changes only the kites after it.
   */
  drawOrder: number;
}

/** Written only by {@link kept}: the last source of each bone node, by live path. */
const keptSources = perObject(() => new Map<string, BoneKiteSource>());

/** `source`, or the equal one this bone had before, so a load that changes nothing re-renders nothing. */
function kept(node: object, bonePath: string, source: BoneKiteSource): BoneKiteSource {
  const sources = keptSources(node);
  const previous = sources.get(bonePath);
  if (previous && sameData(previous, source)) return previous;
  sources.set(bonePath, source);
  return source;
}

/** The kite source of each Bone2D of `tree`, by the live path of the bone. */
export function bindBoneChildren(tree: LiveTree): ReadonlyMap<string, BoneKiteSource> {
  const bones: { path: string; node: object; children: string[] }[] = [];
  const childrenOf = new Map<string, string[]>();
  tree.fold<string | null, void>(null, ({ step, path }, parentBone, descend) => {
    if (step.node.type !== 'Bone2D') return void descend(null);
    const children: string[] = [];
    childrenOf.set(path, children);
    if (parentBone !== null) childrenOf.get(parentBone)!.push(path);
    descend(path);
    bones.push({ path, node: step.node, children });
  });
  return new Map(
    bones.map(({ path, node, children }, rank) => [
      path,
      kept(node, path, { children, drawOrder: rank / (rank + 1) }),
    ])
  );
}
