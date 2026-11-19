export type { NodeOutput } from './nodesHandler.js';
export { installGodotShading, type GodotShading, type GodotShadingOptions } from './godotShading.js';
export type { RendererShaderOptions } from './rendererShaderOptions.js';
export { GODOT_VERSION } from './language/instructionTable.generated.js';
export { ShadingLanguageError } from './language/shadingLanguageError.js';
export { glVaryingSlots } from './glVaryingSlots.js';
export { TranslatorFault, type ShaderSource } from './fault/translatorFault.js';
export {
  transpileShadingLanguage,
  type TranspiledShader,
  type TranspileOptions,
} from './language/transpile.js';
export type { TranspiledUniform } from './uniforms/transpiledUniform.js';
export type { UniformHint, UniformNode, UniformScope } from './language/shaderTree.js';
export type { ShaderOptions } from './language/parseShader.js';
export type { ShaderInclude } from './preprocessor/preprocessor.js';
export type { RenderingMethod } from './preprocessor/renderingMethod.js';
export type { ShaderDecoders } from './preprocessor/decoders.js';
export type { TranspiledFunction } from './language/emitter.js';
export {
  bindRadiance,
  transpileSky,
  type SkyDraw,
  type SkyOptions,
  type TranspiledSky,
} from './sky/transpileSky.js';
export { SkyResolutionPasses } from './sky/skyResolutionPasses.js';
export {
  SKY_BINDINGS,
  writeSkyBindings,
  type SkyFog,
  type SkyLight,
  type SkyScene,
} from './sky/skyBindings.js';
export { transpileSpatial, type SpatialOptions, type TranspiledSpatial } from './spatial/transpileSpatial.js';
export { withGodotAttributes } from './spatial/meshAttributes.js';
export { SCENE_BINDINGS, writeSpatialBindings, type SpatialScene } from './spatial/spatialBindings.js';
export {
  DEFAULT_TIME_ROLLOVER_SECONDS,
  PlaybackShaderTime,
  ShaderClock,
  type Playback,
} from './time/shaderClock.js';
