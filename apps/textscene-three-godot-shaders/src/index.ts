/**
 * The public entry of `@textscene/three-godot-shaders`: core's shader module (ADR-0072). The names
 * are listed one by one, since core is private and each name core exports through a barrel would
 * become a promise to every consumer.
 */

export {
  GODOT_VERSION,
  installNodesHandler,
  ShadingLanguageError,
  transpileShadingLanguage,
} from '@textscene/core/shaders';
export type { NodeOutput, TranspiledFunction, TranspiledShader } from '@textscene/core/shaders';
