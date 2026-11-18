import { readVariant } from '../godot/variant/strToVar.js';
import { varToStr } from '../godot/variant/varToStr.js';
import { VARIANT_TYPE as T, variantTypeName } from '../godot/variant/variantType.js';
import type { VariantValue } from '../godot/variant/variantValue.js';

/** A Godot value of any type, as a `.tscn` file spells it. */
export interface Variant {
  /** The Godot type, as `type_string` names it: `Vector3`, `Color`, `Object`. */
  readonly type: string;
  /** The value as `var_to_str` writes it. */
  readonly text: string;
}

/** What `set` takes and `get` answers: a boolean, a number or a string, else a Variant. */
export type SceneValue = boolean | number | string | Variant;

/** Written only by {@link variantOf}: the value each Variant holds, so a write reads it once. */
// eslint-disable-next-line no-restricted-syntax -- the value makes the key here, so no build from the key exists
const values = new WeakMap<Variant, VariantValue>();

/** The Variant of `value`, its text in the canonical spelling. */
export function variantOf(value: VariantValue): Variant {
  const made = Object.freeze({ type: variantTypeName(value.type) ?? 'Nil', text: varToStr(value) });
  values.set(made, value);
  return made;
}

/** `str_to_var`. It throws with Godot's parse error, so a typing mistake is not a write of null. */
export function variant(text: string): Variant {
  const read = readVariant(text);
  if ('error' in read)
    throw new Error(`expected a Variant as a .tscn file spells it, got "${text}": ${read.error}`);
  return variantOf(read.value);
}

function isVariant(value: unknown): value is Variant {
  return typeof value === 'object' && value !== null && values.has(value as Variant);
}

/** The Godot value of what a host passed: a whole number is an int, as GDScript reads `1`. */
export function valueOfSceneValue(value: SceneValue): VariantValue {
  if (typeof value === 'boolean') return { type: T.BOOL, value };
  if (typeof value === 'number') return { type: Number.isInteger(value) ? T.INT : T.FLOAT, value };
  if (typeof value === 'string') return { type: T.STRING, value };
  if (isVariant(value)) return values.get(value)!;
  throw new Error(`expected a boolean, a number, a string or variant(text), got ${String(value)}`);
}

/** What `get` answers for a Godot value. */
export function sceneValueOf(value: VariantValue): SceneValue {
  switch (value.type) {
    case T.BOOL:
    case T.INT:
    case T.FLOAT:
    case T.STRING:
      return value.value;
  }
  return variantOf(value);
}
