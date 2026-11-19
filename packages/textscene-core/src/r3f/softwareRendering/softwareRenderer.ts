/**
 * Whether a WebGL context draws on the CPU. A browser that turns its GPU off still runs WebGL in a
 * software rasteriser, and every scene then costs many times its GPU frame time.
 */

import { glRendererName } from '../../shaders/pipeline/glRendererName';

/**
 * Chrome and Edge rasterise through SwiftShader, Firefox on Linux through Mesa's llvmpipe or
 * softpipe, Windows without a GPU driver through the Microsoft Basic Render Driver, and macOS
 * without a GPU through the Apple Software Renderer.
 */
const SOFTWARE_RENDERER =
  /SwiftShader|llvmpipe|softpipe|Microsoft Basic Render Driver|Apple Software Renderer/i;

/** Whether `name`, a context's renderer, is one that rasterises on the CPU. */
function isSoftwareRendererName(name: string): boolean {
  return SOFTWARE_RENDERER.test(name);
}

export function rendersInSoftware(gl: WebGL2RenderingContext): boolean {
  const name = glRendererName(gl);
  return name !== null && isSoftwareRendererName(name);
}
