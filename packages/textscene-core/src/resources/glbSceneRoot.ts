/**
 * The node type `processors/createSceneProcessor.ts` synthesises as a `.glb` or `.gltf` scene's
 * root. Its own module, free of the parser, THREE and React, so the tree, the merge and the
 * renderer read it without loading each other.
 */

/** Reserved for a synthesised GLB root: no `.tscn` declares it, and the linter never sees it. */
export const GLB_SCENE_ROOT_TYPE = 'GLBSceneRoot';
