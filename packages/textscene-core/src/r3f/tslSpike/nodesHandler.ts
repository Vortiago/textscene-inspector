/**
 * three's `WebGLNodesHandler` on a canvas's `WebGLRenderer`, so a TSL node material draws beside
 * the patched classic materials. This is the first migration step the spike tests.
 */

import type * as THREE from 'three';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import type { Node } from 'three/webgpu';
import { SplitSunLight } from '../directionalShadow/splitSun.js';
import { classicLitSurfaceInputs } from './classicInputs.js';
import { registerSunLightNode, type LitSurfaceInputs } from './litSurfaceMaterial.js';

/** The hook the handler encodes a material's output through, which three's types leave out. */
interface OutputEncoding {
  getOutputCallback: (outputNode: Node) => Node;
}

/**
 * The inputs every lit node material of the page reads. Written only by `installNodesHandler`, on
 * the first canvas. Null on a page that draws through the classic materials only.
 */
let handlerInputs: LitSurfaceInputs | null = null;

/** Null until a canvas installs the handler. */
export function nodesHandlerInputs(): LitSurfaceInputs | null {
  return handlerInputs;
}

/** Call after `installShaderPatches`, on the canvas's renderer, before its first frame. */
export function installNodesHandler(renderer: THREE.WebGLRenderer): void {
  const handler = new WebGLNodesHandler();
  // The handler encodes every output to the renderer's `outputColorSpace`, also into a render
  // target (r187 `WebGLNodesHandler.js:290-298`). The compositor draws the scene into a linear
  // half-float buffer and encodes it once, so a node material writes linear, as three's own do.
  (handler as unknown as OutputEncoding).getOutputCallback = (outputNode) => outputNode;
  renderer.setNodesHandler(handler);
  handlerInputs ??= classicLitSurfaceInputs();
  registerSunLightNode(SplitSunLight, handlerInputs.sunShadow);
}
