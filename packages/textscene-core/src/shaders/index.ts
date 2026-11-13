/**
 * The shader module (ADR-0072): Godot's scene shader as TSL node materials for a three.js
 * `WebGLRenderer`, with no React. `@textscene/three-godot-shaders` publishes this entry, and the
 * renderer bundles it.
 *
 * The rules every file here keeps, as the port adds nodes:
 * - A file imports `three`, `three/tsl`, `three/webgpu`, `three/addons/*`, a file of `godot/` or a
 *   file of its own. `importRule.test.ts` walks the imports.
 * - A node is built once. It reads each value in its update callback, from the pipeline inputs of
 *   the renderer that draws, and imports no owner of a value. Each pipeline input is optional:
 *   without it, the surface draws what Godot draws without that feature.
 * - The caller fills the pipeline inputs. Under the handler, the frame's renderer is a proxy of the
 *   caller's renderer (r187 `WebGLNodesHandler.js:364-370`), so no node looks its inputs up by the
 *   renderer's identity.
 * - The registration of a light node is page-wide, because three keeps the node class on the light
 *   class (r187 `src/lights/Light.js:18-22`). It happens in an install call, never on import.
 * - The lighting model reads only the surface outputs, the values Godot's `fragment()` writes.
 */

export { installNodesHandler, type NodeOutput } from './nodesHandler.js';
