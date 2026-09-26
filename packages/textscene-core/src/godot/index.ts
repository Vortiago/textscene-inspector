/**
 * Engine facts two domains need (`CMP_EPSILON`), with no imports, so no domain carries its weight
 * into another's bundle (`noDependencies.test.ts`): never `ParseError`, `PropertyValidator`, THREE,
 * React or a node or resource type. One file per engine area, a new file rather than a section:
 * `math.ts` for `math_defs.h` and `math_funcs.h`, `string.ts` for `ustring.cpp`.
 */

export {
  CMP_EPSILON,
  basisDeterminant,
  clamp,
  degToRad,
  isZeroApprox,
  isEqualApprox,
  lerp,
  sign,
  smoothstep,
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
  STRING_LITERAL_RE,
  STRING_LITERAL_SOURCE,
  dropTrailingComma,
  simplifyResPath,
  splitTopLevel,
  stringLiteralBodies,
  stringToFloat,
  stringToInt,
} from './string.js';
export {
  MATERIAL_RENDER_PRIORITY_MIN,
  MATERIAL_RENDER_PRIORITY_MAX,
  CANVAS_ITEM_Z_MIN,
  CANVAS_ITEM_Z_MAX,
  CANVAS_LAYER_MIN,
  CANVAS_LAYER_MAX,
} from './rendering.js';
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
export {
  allFinite,
  FLOAT_PATTERN_SOURCE,
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
  packedArrayCallAnywhere,
  packedArrayLiteral,
  nodePathLiteral,
  arrayLiteralBody,
} from './variantParser.js';
export {
  EXT_RESOURCE_CALL_ANYWHERE_RE,
  type ResourceRef,
  dictSubResourceEntries,
  keyedResourceRefReader,
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
  isGodotTextResourcePath,
} from './resourceFormats.js';
export { boolSlotValue, boolLiteralAsNumber } from './variantBool.js';
export {
  packedArrayBody,
  packedArrayForms,
  packedElementType,
  type PackedArrayBody,
} from './variantParser.js';
