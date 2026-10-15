/**
 * Engine facts two domains need (`CMP_EPSILON`), with no imports, so no domain carries its weight
 * into another's bundle (`noDependencies.test.ts`): never `ParseError`, `PropertyValidator`, THREE,
 * React or a node or resource type. One file per engine area, a new file rather than a section:
 * `math/math.ts` for `math_defs.h` and `math_funcs.h`, `string/string.ts` for `ustring.cpp`.
 */

export {
  CMP_EPSILON,
  basisDeterminant,
  bezierInterpolate,
  clamp,
  degToRad,
  isZeroApprox,
  isEqualApprox,
  lerp,
  sign,
  smoothstep,
  snapped,
} from './math/math.js';
export {
  TRANSFORM2D_IDENTITY,
  type Transform2DColumns,
  affineInverseTransform2D,
  multiplyTransform2D,
  transform2DFromParts,
  transform2DGetScale,
  transform2DHasZeroSkew,
  transform2DIsConformal,
} from './math/transform2d.js';
export { type Rect2, rect2Intersection, rect2Intersects, rect2Merge } from './math/rect2.js';
export {
  type BasisComponents,
  basisGetScale,
  basisGetScaleAbs,
  basisHasUnitScale,
  basisIsOrthonormal,
} from './math/basis.js';
export {
  type IndexParse,
  type LeafResolver,
  declaredLeafResolver,
  firstSegment,
  indexedElements,
  indexedKeyRegex,
  visitIndexedKeys,
} from './classdb/indexedKey.js';
export {
  IS_VALID_INT_RE,
  literalText,
  RES_PATH_BODY_SOURCE,
  STRING_LITERAL_RE,
  STRING_LITERAL_SOURCE,
  dropTrailingComma,
  simplifyResPath,
  splitTopLevel,
  stringLiteralBodies,
  stringToFloat,
  stringToInt,
  stripEdges,
} from './string/string.js';
export {
  MATERIAL_RENDER_PRIORITY_MIN,
  MATERIAL_RENDER_PRIORITY_MAX,
  CANVAS_ITEM_Z_MIN,
  CANVAS_ITEM_Z_MAX,
  CANVAS_LAYER_MIN,
  CANVAS_LAYER_MAX,
  DEFAULT_CLEAR_COLOR,
  ShadowCastingSetting,
} from './rendering/rendering.js';
export {
  CPU_PARTICLES_PARAMS,
  type CpuParticlesParam,
  type CrossedParamRange,
  crossedParamRanges,
} from './scene/cpuParticles.js';
export { formatReal, storedReal } from './math/real.js';
export { BillboardMode } from './scene/billboard.js';
export {
  GODOT_GLTF_EXTENSIONS,
  gltfRefusalMessage,
  isGltfPath,
  readGltfRequiredExtensions,
  requiredGltfExtensions,
  unsupportedRequiredGltfExtensions,
} from './import/gltf.js';
export {
  PROJECT_FILE_NAME,
  PROJECT_FILE_PATH,
  extensionListEntries,
  extensionListPath,
  dataDirectoryPath,
} from './project/project.js';
export {
  GDEXTENSION_FILE_EXTENSION,
  SCAN_STOP_FILES,
  isScannedDirectoryName,
  isScannedPath,
} from './project/editorScan.js';
export {
  DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT,
  DirectionalLightSkyMode,
  directionalLightDrawsInSky,
  directionalLightLightsSurfaces,
} from './rendering/lights/directionalLightSkyMode.js';
export { fadeAlpha, forcesAlphaPass } from './rendering/fadeAlpha.js';
export { unitByte } from './variant/unitByte.js';
export {
  DIRECTIONAL_SHADOW_BLEND_SPLITS_DEFAULT,
  DIRECTIONAL_SHADOW_FADE_START_DEFAULT,
  DIRECTIONAL_SHADOW_MAX_DISTANCE_DEFAULT,
  DIRECTIONAL_SHADOW_MAX_SPLITS,
  DIRECTIONAL_SHADOW_MODE_DEFAULT,
  DIRECTIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
  DIRECTIONAL_SHADOW_PANCAKE_SIZE_DEFAULT,
  DIRECTIONAL_SHADOW_SIZE_DEFAULT,
  DIRECTIONAL_SHADOW_SPLIT_OFFSETS_DEFAULT,
  MAX_DIRECTIONAL_LIGHTS,
  type DirectionalShadowAtlasRect,
  type DirectionalShadowFade,
  DirectionalShadowMode,
  type DirectionalShadowSlice,
  blendsSplits,
  directionalLightsDrawn,
  directionalShadowBlendStart,
  directionalShadowFade,
  directionalShadowLightRect,
  directionalShadowSlice,
  directionalShadowSnapStep,
  directionalShadowSplitAtlasRect,
  directionalShadowSplitCount,
  directionalShadowSplitDistances,
  directionalShadowSplitEnds,
  directionalShadowSplitRange,
  directionalShadowSplitTextureSize,
  directionalShadowTexelSize,
  pancakesCasters,
  sharesDirectionalShadowAtlas,
  texelPaddedRadius,
} from './rendering/lights/directionalShadow.js';
export {
  SHADOW_BLUR_DEFAULT,
  SOFT_LOW_QUALITY_RADIUS,
  softShadowScale,
} from './rendering/lights/softShadowScale.js';
export {
  SOFT_LOW_PENUMBRA_SAMPLES,
  SOFT_LOW_SHADOW_SAMPLES,
  vogelDisk,
} from './rendering/lights/softShadowKernel.js';
export {
  POSITIONAL_SHADOW_ATLAS_DEPTH_BITS,
  POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT,
  POSITIONAL_SHADOW_QUADRANT_SUBDIV_DEFAULT,
  POSITIONAL_SHADOW_QUADRANT_SUBDIV_SHADOWS,
  POSITIONAL_SHADOW_REALLOC_TOLERANCE_MSEC,
  PositionalShadowAtlas,
  ROOT_POSITIONAL_SHADOW_ATLAS,
  VIEWPORT_POSITIONAL_SHADOW_ATLAS_SIZE_DEFAULT,
  omniShadowCubeSize,
  positionalShadowQuadrantSubdivision,
  viewportPositionalShadowAtlas,
  type PositionalShadowAtlasSettings,
  type PositionalShadowRequest,
  type PositionalShadowSlot,
} from './rendering/lights/positionalShadowAtlas.js';
export { LIGHT_SHADOW_NORMAL_BIAS_DEFAULT, LIGHT_SIZE_DEFAULT } from './scene/light.js';
export {
  positionalLightBounds,
  positionalShadowNear,
  positionalShadowNormalBias,
  positionalSoftShadow,
  spotShadowDepthBias,
  type PositionalSoftShadow,
} from './rendering/lights/positionalShadow.js';
export { GRADIENT_TEXTURE_MAX_SIZE, IMAGE_MAX_PIXELS, formatHasSrgbView } from './rendering/texture.js';
export { VIEWPORT_MIN_SIZE } from './rendering/viewport.js';
export { CLIP_CHILDREN_DISABLED, CLIP_CHILDREN_MAX, CLIP_CHILDREN_MODES } from './scene/canvasItem.js';
export {
  CURSOR_ARROW,
  CURSOR_MAX,
  CURSOR_SHAPES,
  LAYOUT_DIRECTION_INHERITED,
  LAYOUT_DIRECTION_APPLICATION_LOCALE,
  LAYOUT_DIRECTION_LTR,
  LAYOUT_DIRECTION_RTL,
  LAYOUT_DIRECTION_SYSTEM_LOCALE,
  LAYOUT_DIRECTION_MAX,
  LTR_LAYOUT_ENV,
  resolveLayoutRtl,
  type LayoutDirectionEnv,
} from './scene/control.js';
export { isLocaleRightToLeft, RTL_LANGUAGE_CODES } from './text/textServer.js';
export { isColorString } from './variant/color.js';
export {
  allFinite,
  FLOAT_PATTERN_SOURCE,
  INT_TOKEN_RE,
  TSCN_FLOAT_PATTERN_SOURCE,
  TSCN_FLOAT_RE,
  slotTupleRegex,
  parseGodotFloat,
} from './variant/number.js';
export {
  INT32_MAX,
  type IntWidth,
  parseGodotInt,
  ruleCount,
  ruleInt,
  readerLimitedInt,
  storedFromFloat,
  storedInt,
  storedVector2i,
  toInt16,
  toInt32,
  toUint32,
} from './variant/int.js';
export { DEFAULT_ANIMATION_NAME } from './scene/animation.js';
export { canonicalPropertyName, isDeprecatedPropertyName } from './classdb/deprecated.js';
export {
  ARRAY_LITERAL_RE,
  NODE_PATH_LITERAL_RE,
  NODE_PATH_LITERAL_ANYWHERE_RE,
  TYPED_OR_BARE_ARRAY_RE,
  TYPED_WRAPPER_RE,
  compositeCallPrefix,
  dictCallField,
  isNilLiteral,
  JACKETED_STRING_RE,
  variantShape,
  type VariantShape,
  packedArrayCallAnywhere,
  packedArrayLiteral,
  nodePathLiteral,
  arrayLiteralBody,
  packedArrayBody,
  packedArrayForms,
  packedElementType,
  STRING_ARRAY_FORMS,
  stringArrayBodies,
  type PackedArrayBody,
} from './variant/variantParser.js';
export {
  EXT_RESOURCE_CALL_ANYWHERE_RE,
  extResourceIdsIn,
  type ResourceRef,
  dictSubResourceEntries,
  keyedResourceRefReader,
  isPathResourceLiteral,
  resourceRef,
  subResourceRefAnywhere,
} from './variant/resourceRef.js';
export { dictPackedField } from './variant/packedArrayFields.js';
export {
  MAX_BASE_CHAIN_HOPS,
  NODE_BASE_TYPES,
  UNCATALOGUED_BASE_TYPES,
  baseChain,
  descendsFrom,
  isCatalogedType,
} from './classdb/nodeBaseTypes.js';
export { CLASS_BASE_TYPES, descendsFromClass } from './classdb/classBaseTypes.js';
export { INSTANCE_PLACEHOLDER_TYPE } from './scene/packedScene.js';
export { nodePathNames } from './string/nodePath.js';
export {
  GODOT_TEXT_RESOURCE_EXTENSIONS,
  IMPORT_SIDECAR_SUFFIX,
  importSidecarPath,
  UNWRAP_CACHE_SUFFIX,
  unwrapCachePath,
  isGodotTextResourcePath,
} from './project/resourceFormats.js';
export { boolSlotValue, boolLiteralAsNumber } from './variant/variantBool.js';
