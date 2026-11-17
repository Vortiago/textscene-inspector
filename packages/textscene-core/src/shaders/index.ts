export { installNodesHandler, type NodeOutput } from './nodesHandler.js';
export { GODOT_VERSION } from './language/instructionTable.generated.js';
export { ShadingLanguageError } from './language/shadingLanguageError.js';
export {
  transpileShadingLanguage,
  type TranspiledShader,
  type TranspileOptions,
} from './language/transpile.js';
export type { TranspiledUniform } from './uniforms/transpiledUniform.js';
export type { UniformHint, UniformNode, UniformScope } from './language/shaderTree.js';
export type { ShaderOptions } from './language/parseShader.js';
export type { RenderingMethod, ShaderInclude } from './preprocessor/preprocessor.js';
export type { ShaderDecoders } from './preprocessor/decoders.js';
export type { TranspiledFunction } from './language/emitter.js';
export { transpileSky, type TranspiledSky } from './sky/transpileSky.js';
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
