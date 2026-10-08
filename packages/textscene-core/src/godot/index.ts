/**
 * Engine facts two domains need (`CMP_EPSILON`), with no imports, so no domain carries its weight
 * into another's bundle (`noDependencies.test.ts`): never `ParseError`, `PropertyValidator`, THREE,
 * React or a node or resource type. One file per engine area, a new file rather than a section:
 * `math.ts` for `math_defs.h` and `math_funcs.h`, `string.ts` for `ustring.cpp`.
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
} from './math.js';
export {
  TRANSFORM2D_IDENTITY,
  type Transform2DColumns,
  affineInverseTransform2D,
  multiplyTransform2D,
  transform2DFromParts,
  transform2DGetScale,
  transform2DHasZeroSkew,
  transform2DIsConformal,
} from './transform2d.js';
export { type Rect2, rect2Intersection, rect2Intersects, rect2Merge } from './rect2.js';
export {
  type BasisComponents,
  basisGetScale,
  basisGetScaleAbs,
  basisHasUnitScale,
  basisIsOrthonormal,
} from './basis.js';
export {
  type IndexParse,
  type LeafResolver,
  declaredLeafResolver,
  firstSegment,
  indexedElements,
  indexedKeyRegex,
  visitIndexedKeys,
} from './indexedKey.js';
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
} from './string.js';
export {
  MATERIAL_RENDER_PRIORITY_MIN,
  MATERIAL_RENDER_PRIORITY_MAX,
  CANVAS_ITEM_Z_MIN,
  CANVAS_ITEM_Z_MAX,
  CANVAS_LAYER_MIN,
  CANVAS_LAYER_MAX,
  DEFAULT_CLEAR_COLOR,
  ShadowCastingSetting,
} from './rendering.js';
export {
  CPU_PARTICLES_PARAMS,
  type CpuParticlesParam,
  type CrossedParamRange,
  crossedParamRanges,
} from './cpuParticles.js';
export { formatReal, storedReal } from './real.js';
export { BillboardMode } from './billboard.js';
export {
  GODOT_GLTF_EXTENSIONS,
  gltfRefusalMessage,
  isGltfPath,
  readGltfRequiredExtensions,
  requiredGltfExtensions,
  unsupportedRequiredGltfExtensions,
} from './gltf.js';
export {
  PROJECT_FILE_NAME,
  PROJECT_FILE_PATH,
  extensionListEntries,
  extensionListPath,
  dataDirectoryPath,
} from './project.js';
export {
  GDEXTENSION_FILE_EXTENSION,
  SCAN_STOP_FILES,
  isScannedDirectoryName,
  isScannedPath,
} from './editorScan.js';
export {
  DIRECTIONAL_LIGHT_SKY_MODE_DEFAULT,
  DirectionalLightSkyMode,
  directionalLightDrawsInSky,
  directionalLightLightsSurfaces,
} from './directionalLightSkyMode.js';
export { fadeAlpha, forcesAlphaPass } from './fadeAlpha.js';
export { unitByte } from './unitByte.js';
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
} from './directionalShadow.js';
export { SHADOW_BLUR_DEFAULT, SOFT_LOW_QUALITY_RADIUS, softShadowScale } from './softShadowScale.js';
export { SOFT_LOW_SHADOW_SAMPLES, vogelDisk } from './softShadowKernel.js';
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
} from './positionalShadowAtlas.js';
export {
  POSITIONAL_SHADOW_NORMAL_BIAS_DEFAULT,
  positionalLightBounds,
  positionalShadowNear,
  positionalShadowNormalBias,
  spotShadowDepthBias,
} from './positionalShadow.js';
export { GRADIENT_TEXTURE_MAX_SIZE, IMAGE_MAX_PIXELS } from './texture.js';
export { CLIP_CHILDREN_DISABLED, CLIP_CHILDREN_MAX, CLIP_CHILDREN_MODES } from './canvasItem.js';
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
} from './control.js';
export { isLocaleRightToLeft, RTL_LANGUAGE_CODES } from './textServer.js';
export { isColorString } from './color.js';
export {
  allFinite,
  FLOAT_PATTERN_SOURCE,
  INT_TOKEN_RE,
  TSCN_FLOAT_PATTERN_SOURCE,
  TSCN_FLOAT_RE,
  slotTupleRegex,
  parseGodotFloat,
} from './number.js';
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
} from './int.js';
export { DEFAULT_ANIMATION_NAME } from './animation.js';
export { canonicalPropertyName, isDeprecatedPropertyName } from './deprecated.js';
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
} from './variantParser.js';
export {
  EXT_RESOURCE_CALL_ANYWHERE_RE,
  extResourceIdsIn,
  type ResourceRef,
  dictSubResourceEntries,
  keyedResourceRefReader,
  isPathResourceLiteral,
  resourceRef,
  subResourceRefAnywhere,
} from './resourceRef.js';
export { dictPackedField } from './packedArrayFields.js';
export {
  MAX_BASE_CHAIN_HOPS,
  NODE_BASE_TYPES,
  UNCATALOGUED_BASE_TYPES,
  baseChain,
  descendsFrom,
  isCatalogedType,
} from './nodeBaseTypes.js';
export { CLASS_BASE_TYPES, descendsFromClass } from './classBaseTypes.js';
export { INSTANCE_PLACEHOLDER_TYPE } from './packedScene.js';
export { nodePathNames } from './nodePath.js';
export {
  GODOT_TEXT_RESOURCE_EXTENSIONS,
  IMPORT_SIDECAR_SUFFIX,
  importSidecarPath,
  isGodotTextResourcePath,
} from './resourceFormats.js';
export { boolSlotValue, boolLiteralAsNumber } from './variantBool.js';
export {
  packedArrayBody,
  packedArrayForms,
  packedElementType,
  STRING_ARRAY_FORMS,
  stringArrayBodies,
  type PackedArrayBody,
} from './variantParser.js';
