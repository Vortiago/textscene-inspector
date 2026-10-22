/**
 * The node type `processors/createSceneProcessor.ts` synthesises as a `.glb` or `.gltf` scene's
 * root. Its own module, free of the parser, THREE and React, so the tree, the merge and the
 * renderer read it without loading each other.
 */

/** Reserved for a synthesised GLB root: no `.tscn` declares it, and the linter never sees it. */
export const GLB_SCENE_ROOT_TYPE = 'GLBSceneRoot';

/** The `.glb` path a synthesised GLB root loads, or undefined for any other node. */
export function glbPathOf(node: { type: string; properties: object }): string | undefined {
  return node.type === GLB_SCENE_ROOT_TYPE ? (node.properties as { glbPath?: string }).glbPath : undefined;
}

/**
 * The `.glb` path of a sub-scene whose only root is a synthesised GLB root, an instanced `.glb`, or
 * undefined for any other sub-scene. Only such a sub-scene takes a host's typed children into its nodes.
 */
export function loneGlbRootPath(roots: readonly { type: string; properties: object }[]): string | undefined {
  return roots.length === 1 ? glbPathOf(roots[0]!) : undefined;
}
