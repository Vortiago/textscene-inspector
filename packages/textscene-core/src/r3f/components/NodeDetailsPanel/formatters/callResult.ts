import { isNodeHandle, type CallResult } from '../../../../scene/nodeMethods';
import { valueOfSceneValue } from '../../../../scene/variant';
import { VARIANT_TYPE as T } from '../../../../godot/variant/variantType';
import type { VariantValue } from '../../../../godot/variant/variantValue';

/** The Variant value a `call` answered, null for a node or for nothing. */
export function variantValueOf(result: CallResult): VariantValue | null {
  return result === null || isNodeHandle(result) ? null : valueOfSceneValue(result);
}

/** The elements of the Array a `call` answered, none for any other answer. */
export function arrayElementsOf(result: CallResult): readonly VariantValue[] {
  const value = variantValueOf(result);
  return value?.type === T.ARRAY ? value.elements : [];
}
