/**
 * The public entry of `@textscene/three-godot-shaders`: core's shader module (ADR-0072). The names
 * are listed one by one, since core is private and each name core exports through a barrel would
 * become a promise to every consumer.
 */

export {
  DEFAULT_TIME_ROLLOVER_SECONDS,
  GODOT_VERSION,
  glVaryingSlots,
  installGodotShading,
  PlaybackShaderTime,
  ShaderClock,
  ShadingLanguageError,
  SCENE_BINDINGS,
  TranslatorFault,
  SKY_BINDINGS,
  bindRadiance,
  SkyResolutionPasses,
  transpileShadingLanguage,
  transpileSky,
  transpileSpatial,
  withGodotAttributes,
  writeSkyBindings,
  writeSpatialBindings,
} from '@textscene/core/shaders';
export type {
  GodotShading,
  GodotShadingOptions,
  NodeOutput,
  Playback,
  RendererShaderOptions,
  RenderingMethod,
  ShaderInclude,
  ShaderSource,
  ShaderOptions,
  SkyDraw,
  SkyFog,
  SkyLight,
  SkyOptions,
  SkyScene,
  SpatialOptions,
  SpatialScene,
  TranspiledFunction,
  TranspiledShader,
  TranspiledSky,
  TranspiledSpatial,
  TranspiledUniform,
  TranspileOptions,
  UniformHint,
  UniformNode,
  UniformScope,
} from '@textscene/core/shaders';
// A parameter takes a Godot Variant, which an app reads from the text of a resource file.
export type { Variant } from '@textscene/core/godot';
export { textToVariant } from '@textscene/core/godot/variantReader';
