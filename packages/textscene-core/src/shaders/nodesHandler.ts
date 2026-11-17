/**
 * three's `WebGLNodesHandler` on a `WebGLRenderer`, so a TSL node material draws beside the
 * renderer's classic materials. With no node material in a frame, the handler makes no GL call.
 */

import type * as THREE from 'three';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import type { Node } from 'three/webgpu';
import { driverLog, TranslatorFault } from './fault/translatorFault.js';
import { BoundNodeMaterial } from './uniforms/boundMaterial.js';

/**
 * What a node material writes. `display` is the handler's own form: the renderer's tone mapping,
 * then its `outputColorSpace` (r187 `WebGLNodesHandler.js:304-312`). `linear` writes the lit colour
 * unchanged, for a caller that tone maps and encodes the frame once itself.
 */
export type NodeOutput = 'linear' | 'display';

/** What the handler holds that three's types leave out: its output hook, and the material it draws now. */
interface HandlerInternals {
  getOutputCallback: (outputNode: Node) => Node;
  nodeFrame: { material: unknown };
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
  const handler = new WebGLNodesHandler();
  const internals = handler as unknown as HandlerInternals;
  if (output === 'linear') internals.getOutputCallback = (outputNode) => outputNode;
  renderer.setNodesHandler(handler);
  reportTranslatorFaults(renderer, internals);
  withHandler.add(renderer);
}

type ShaderErrorHook = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
) => void;

/** A refused program as a fault of its transpiled material, or to the earlier hook or the console. */
function reportTranslatorFaults(renderer: THREE.WebGLRenderer, handler: HandlerInternals): void {
  const debug = renderer.debug as { onShaderError: ShaderErrorHook | null };
  const previous = debug.onShaderError;
  debug.onShaderError = (gl, program, vertexShader, fragmentShader) => {
    const log = driverLog(gl, program, vertexShader, fragmentShader);
    // The handler sets the material before three builds its program (`WebGLNodesHandler.js:318`).
    const { material } = handler.nodeFrame;
    if (material instanceof BoundNodeMaterial && drawsWith(renderer, material, program))
      material.reportFault(new TranslatorFault(material.source, log));
    else if (previous) previous(gl, program, vertexShader, fragmentShader);
    else console.error(`THREE.WebGLProgram: the GPU refused a program.\n${log}`);
  };
}

/** Whether `program` is the one three just built for `material`, not a program of another draw. */
function drawsWith(renderer: THREE.WebGLRenderer, material: THREE.Material, program: WebGLProgram): boolean {
  const properties = renderer.properties.get(material) as { currentProgram?: { program: WebGLProgram } };
  return properties.currentProgram?.program === program;
}
