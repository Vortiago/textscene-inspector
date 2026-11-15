/**
 * Who embeds a window, asked of the live tree. The tree holds whether the root window embeds its
 * windows (`LiveTreeContext.project`), which decides what a window below it embeds, so every
 * reader asks here and none holds the root's answer.
 */
import type { TscnNode } from '../../../parser/types.js';
import type { LiveLink, LiveStep, LiveTree } from '../../../r3f/liveSceneTree.js';
import { parentPathOf } from '../../../utils/nodePath.js';
import {
  embeddingProperties,
  isEmbeddedWindow,
  isRegisteredWindow,
  isViewportBoundary,
  mayHoldWindow,
  type EmbeddingNode,
} from './viewportBoundary.js';

/**
 * Whether a viewport of `tree` embeds the windows below it, so the climb to an embedder stops
 * there. `null` asks the root window. A window that enters the tree under an embedding root has
 * `gui_embed_subwindows` reset to `force_native` (`window.cpp:1534-1537`), so its authored value
 * counts only under a root that embeds none.
 */
export function embedsSubwindows(tree: LiveTree, viewport: EmbeddingNode | null): boolean {
  const { rootEmbedsSubwindows } = tree.ctx.project;
  if (viewport === null) return rootEmbedsSubwindows;
  const { gui_embed_subwindows, force_native } = embeddingProperties(viewport);
  const isResetOnEntry = isEmbeddedWindow(viewport.type) && rootEmbedsSubwindows;
  return (isResetOnEntry ? force_native : gui_embed_subwindows) === true;
}

/**
 * `Window::get_embedder` (`window.cpp:1400-1415`): the path of the nearest viewport above `path`
 * that embeds subwindows, or null where the climb ends at the root window.
 */
export function windowEmbedderPathAt(tree: LiveTree, path: string): string | null {
  for (let above = parentPathOf(path); above !== null; above = parentPathOf(above)) {
    const aboveNode = tree.at(above)?.step.node;
    if (aboveNode && isViewportBoundary(aboveNode.type) && embedsSubwindows(tree, aboveNode)) return above;
  }
  return null;
}

/**
 * Whether a window may sit below `step`: the children a fold descends into, which hold a sub-scene's
 * nodes where the step instances one, and its raw node's children do not.
 */
export function mayHoldWindowBelow(step: LiveStep): boolean {
  return step.groups.some((group) => group.children.some(mayHoldWindow));
}

/**
 * Whether `viewport` draws a window over its canvas: it embeds windows, and a registered one below
 * it climbs to it, past each viewport that embeds none. A hidden window does not register, but the
 * windows below it still climb. `below` is the viewport's link, or absent where its children are
 * the roots of `tree`.
 */
export function embedsAWindow(tree: LiveTree, viewport: TscnNode, below?: LiveLink): boolean {
  if (!embedsSubwindows(tree, viewport)) return false;
  let isReached = false;
  tree.fold<void, void>(
    undefined,
    ({ step }, _, descend) => {
      // One registered window answers, so the walk descends below no node after it.
      if (isReached) return;
      isReached = isRegisteredWindow(step.node);
      if (!isReached && !embedsSubwindows(tree, step.node) && mayHoldWindowBelow(step)) descend();
    },
    below
  );
  return isReached;
}
