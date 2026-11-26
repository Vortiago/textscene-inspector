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
  skyMaterialShader,
  type SkyMaterialProperties,
  type SkyMaterialShader,
} from './sky/materials/skyMaterialShader.js';
export {
  SKY_BINDINGS,
  writeSkyBindings,
  type SkyFog,
  type SkyLight,
  type SkyScene,
  type SkyVolumetricFog,
} from './sky/skyBindings.js';
export { transpileSpatial, type SpatialOptions, type TranspiledSpatial } from './spatial/transpileSpatial.js';
export { DEFAULT_CANVAS_SHADER } from './canvas/defaultCanvasShader.js';
export {
  CANVAS_VARIANTS,
  specialiseCanvasDraw,
  transpileCanvasItem,
  type CanvasDraw,
  type CanvasItemOptions,
  type CanvasSpecialisation,
  type CanvasVariant,
  type TranspiledCanvasItem,
} from './canvas/transpileCanvas.js';
export {
  CANVAS_BINDINGS,
  writeCanvasBindings,
  type CanvasFrame,
  type TargetViewport,
} from './canvas/canvasBindings.js';
export type { CanvasItemDraw } from './canvas/canvasInstance.js';
export {
  NINE_PATCH_AXIS_MODES,
  ninePatchInstanceData,
  quadBatchGeometry,
  rectInstanceData,
  textureRectRegion,
  type CanvasNinePatchCommand,
  type CanvasRectCommand,
  type NinePatchAxisMode,
} from './canvas/canvasRect.js';
export {
  primitiveBatchGeometry,
  primitiveBatchObject,
  primitiveCommand,
  primitiveDraw,
  primitiveInstanceData,
  type CanvasPrimitive,
  type CanvasPrimitiveCommand,
} from './canvas/canvasPrimitive.js';
export {
  attributesGeometry,
  attributesObject,
  attributesVariant,
  meshConstants,
  polygonCommand,
  polygonConstants,
  primitiveObject,
  triangleArrayCommand,
  type AttributesConstants,
  type CanvasMeshPlacement,
  type CanvasVertexArrays,
} from './canvas/canvasAttributes.js';
export {
  CanvasTextureBinding,
  GODOT_CANVAS_TEXTURE_STATE,
  type CanvasTextureFilter,
  type CanvasTextureRepeat,
  type CanvasTextureState,
  type TexelSize,
} from './canvas/canvasTexture.js';
export type { PointDraw } from './spatial/spatialPipeline.js';
export type { DirectionalLight } from './spatial/directionalLights.js';
export type { SceneSky } from './spatial/sceneSky.js';
export { withGodotAttributes, withSurfaceStarts, type GodotPrimitive } from './spatial/meshAttributes.js';
export { emulatedPointGeometry } from './template/emulatedPoints.js';
export { createDepthPrepass, type DepthPrepass, type DepthPrepassOptions } from './pipeline/depthPrepass.js';
export {
  SCENE_BINDINGS,
  specialiseSpatial,
  writeSpatialBindings,
  type SpatialScene,
} from './spatial/spatialBindings.js';
export type { EnvironmentFog } from './pipeline/environmentFog.js';
export {
  DEFAULT_TIME_ROLLOVER_SECONDS,
  PlaybackShaderTime,
  ShaderClock,
  type Playback,
} from './time/shaderClock.js';
