/**
 * The public entry of `@textscene/three-godot-shaders`: core's shader module (ADR-0072). The names
 * are listed one by one, since core is private and each name core exports through a barrel would
 * become a promise to every consumer.
 */

export {
  GODOT_VERSION,
  installNodesHandler,
  ShadingLanguageError,
  SKY_BINDINGS,
  transpileShadingLanguage,
  transpileSky,
  writeSkyBindings,
} from '@textscene/core/shaders';
export type {
  NodeOutput,
  RenderingMethod,
  ShaderInclude,
  ShaderOptions,
  SkyFog,
  SkyLight,
  SkyScene,
  TranspiledFunction,
  TranspiledShader,
  TranspiledSky,
  TranspiledUniform,
  TranspileOptions,
  UniformHint,
  UniformNode,
  UniformScope,
} from '@textscene/core/shaders';
// A parameter takes a Godot Variant, which an app reads from the text of a resource file.
export type { Variant } from '@textscene/core/godot';
export { textToVariant } from '@textscene/core/godot/variantReader';
