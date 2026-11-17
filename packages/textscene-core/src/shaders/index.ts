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
export { baseMaterialShader, shaderTextOf } from './material/baseMaterialShader.js';
export { materialParameters } from './material/materialParameters.js';
export {
  materialStateOf,
  type MaterialClass,
  type MaterialSettings,
  type MaterialState,
  type MaterialTexture,
  type MaterialValue,
} from './material/materialProperties.js';
export { stencilPassOf, type StencilPass } from './material/stencilEffect.js';
