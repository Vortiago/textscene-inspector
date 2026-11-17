/**
 * three's `WebGLNodesHandler` on a `WebGLRenderer`, so a TSL node material draws beside the
 * renderer's classic materials. With no node material in a frame, the handler makes no GL call.
 */

import type * as THREE from 'three';
import { WebGLNodesHandler } from 'three/addons/tsl/WebGLNodesHandler.js';
import type { Node } from 'three/webgpu';
import { driverLog, TranslatorFault } from './fault/translatorFault.js';
import { shaderErrorReport, type ProgramNames } from './fault/shaderErrorReport.js';
import { boundMaterials } from './uniforms/boundMaterial.js';

/**
 * What a node material writes. `display` is the handler's own form: the renderer's tone mapping,
 * then its `outputColorSpace` (r187 `WebGLNodesHandler.js:304-312`). `linear` writes the lit colour
 * unchanged, for a caller that tone maps and encodes the frame once itself.
 */
export type NodeOutput = 'linear' | 'display';

/** The hook three's types leave out of the handler. */
interface OutputHook {
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
  const handler = new WebGLNodesHandler();
  if (output === 'linear') (handler as unknown as OutputHook).getOutputCallback = (outputNode) => outputNode;
  renderer.setNodesHandler(handler);
  reportTranslatorFaults(renderer);
  withHandler.add(renderer);
}

type ShaderErrorHook = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
) => void;

/** Hands a refused program to its transpiled materials, then to the caller's hook or three's report. */
function reportTranslatorFaults(renderer: THREE.WebGLRenderer): void {
  const { debug } = renderer as unknown as { debug: { onShaderError: ShaderErrorHook | null } };
  let callerHook = debug.onShaderError;
  /** True while the caller's hook runs, so a hook that calls the one it replaced does not loop. */
  let isReporting = false;
  const report: ShaderErrorHook = (gl, program, vertexShader, fragmentShader) => {
    if (isReporting) return;
    isReporting = true;
    try {
      const faulty = [...boundMaterials()].filter((material) => drawsWith(renderer, material, program));
      const log = driverLog(gl, program, vertexShader, fragmentShader);
      for (const material of faulty) material.reportFault(new TranslatorFault(material.source, log));
      if (callerHook) callerHook(gl, program, vertexShader, fragmentShader);
      else if (faulty.length === 0)
        console.error(
          shaderErrorReport(gl, program, [vertexShader, fragmentShader], namesOf(renderer, program))
        );
    } finally {
      isReporting = false;
    }
  };
  // A hook the caller sets after the install runs behind this one, so a fault still reaches its material.
  Object.defineProperty(debug, 'onShaderError', {
    configurable: true,
    enumerable: true,
    get: () => report,
    set: (hook: ShaderErrorHook | null) => {
      callerHook = hook;
    },
  });
}

/** Whether three built `program` for `material` on `renderer`, by `compile` or by a draw. */
function drawsWith(renderer: THREE.WebGLRenderer, material: THREE.Material, program: WebGLProgram): boolean {
  if (!renderer.properties.has(material)) return false;
  const properties = renderer.properties.get(material) as { currentProgram?: { program: WebGLProgram } };
  return properties.currentProgram?.program === program;
}

/** The names three's report gives for `program`, from the renderer's list of programs. */
function namesOf(renderer: THREE.WebGLRenderer, program: WebGLProgram): ProgramNames | undefined {
  const programs = renderer.info.programs as unknown as readonly (ProgramNames & { program: WebGLProgram })[];
  return programs?.find((entry) => entry.program === program);
}
