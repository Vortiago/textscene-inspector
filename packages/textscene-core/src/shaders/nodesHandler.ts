/**
 * three's `WebGLNodesHandler` on a `WebGLRenderer`, so a TSL node material draws beside the
 * renderer's classic materials. With no node material in a frame, the handler makes no GL call.
 */

import type * as THREE from 'three';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import type { Node } from 'three/webgpu';

/**
 * What a node material writes. `display` is the handler's own form: the renderer's tone mapping,
 * then its `outputColorSpace` (r187 `WebGLNodesHandler.js:304-312`). `linear` writes the lit colour
 * unchanged, for a caller that tone maps and encodes the frame once itself.
 */
export type NodeOutput = 'linear' | 'display';

/** The hook the handler encodes an output through, which three's types leave out. */
interface OutputEncoding {
  getOutputCallback: (outputNode: Node) => Node;
}

/**
 * The renderers that hold a handler. Written only by `installNodesHandler`. three keeps the
 * handler in a closure with no getter (r187 `WebGLRenderer.js:1077-1082`), so this is the one record.
 */
const withHandler = new WeakSet<THREE.WebGLRenderer>();

/**
 * Gives `renderer` a nodes handler before its first frame. A second call for the same renderer
 * changes nothing, whatever its `output`.
 */
export function installNodesHandler(renderer: THREE.WebGLRenderer, output: NodeOutput = 'display'): void {
  if (withHandler.has(renderer)) return;
  withHandler.add(renderer);
  const handler = new WebGLNodesHandler();
  if (output === 'linear')
    (handler as unknown as OutputEncoding).getOutputCallback = (outputNode) => outputNode;
  renderer.setNodesHandler(handler);
}
