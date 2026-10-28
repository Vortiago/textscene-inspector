/**
 * Finds the production files of `@textscene/core` that read a node of the Live scene tree without
 * laying the live node patches over it (ADR-0060). A node of a sub-scene is shared by every
 * instance, so a pass binds its result by live path, and a reader that skips the overlay sees the
 * node where it was authored.
 */

import { isTestFile } from './sourceTree.mjs';

/** A way to take a node out of the live tree: a link's step, or a hook or lookup that returns one. */
const LIVE_NODE_READ =
  /\bstep\.node\b|\buseLiveNode\(|\buseLiveStepOf\(|\buseLiveSceneNodes\(|\bresolveLiveEntry\(/;

/** A way to lay the patches over a node, or to read the passes that make them. */
const PATCH_OVERLAY =
  /\b(patchedNode|useLivePatchedNode|useLivePatchedChain|useLivePatchesBelow|liveNodePatches|liveScenePassResults)\b/;

/**
 * The files in `files`, path to text, that read a live node and neither overlay the patches nor
 * appear in `reasons`, a map of path to why the file needs no overlay.
 */
export function readersWithoutPatches(files, reasons) {
  return [...files]
    .filter(([path, text]) => !isTestFile(path) && LIVE_NODE_READ.test(text) && !PATCH_OVERLAY.test(text))
    .map(([path]) => path)
    .filter((path) => !reasons.has(path));
}

/** The paths in `reasons` that no longer read a live node, so their reason is stale. */
export function staleReasons(files, reasons) {
  return [...reasons.keys()].filter((path) => {
    const text = files.get(path);
    return text === undefined || !LIVE_NODE_READ.test(text) || PATCH_OVERLAY.test(text);
  });
}
