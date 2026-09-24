/**
 * Composite spellings a property slot accepts besides its own type name. `Variant::can_convert_strict`
 * (`variant.cpp:536-830`) decides it, and the write casts through `VariantCaster<T>::cast` (`binder_common.h:223`): on 4.6.3,
 * `SubViewport.size = Vector2(1920, 1080)` opens and stores `Vector2i(1920, 1080)`.
 */

/**
 * Same-arity conversions, keyed by the slot's declared type. Reshaping ones (`Transform2D` → `Transform3D`, `Quaternion` ↔
 * `Basis`, `Projection` ← `Transform3D`) rebuild a matrix, and the string family is no tuple grammar, so neither is here.
 * A `Map`: `typeName` comes from a validator parameter, and a plain object would answer `constructor` with a function,
 * so the spread below would throw `also is not iterable` instead of returning a diagnostic.
 */
const CONVERTIBLE_SPELLINGS = new Map<string, readonly string[]>(Object.entries({
  Vector2: ['Vector2i'],
  Vector2i: ['Vector2'],
  Vector3: ['Vector3i'],
  Vector3i: ['Vector3'],
  Vector4: ['Vector4i'],
  Vector4i: ['Vector4'],
  Rect2: ['Rect2i'],
  Rect2i: ['Rect2'],
}));

/**
 * The regex alternation matching every spelling a `typeName` slot accepts, the type's own name first so a canonical value
 * matches on the first branch. A type with no conversions returns its bare name, so a builder interpolates it unconditionally.
 * The linter's `makeFloatTupleRegex` and the renderer's `slotTupleRegex` differ only in whether a component may be
 * non-finite, and both interpolate this, so the previewer never defaults a spelling the linter accepts.
 */
export function compositeSpellings(typeName: string): string {
  const also = CONVERTIBLE_SPELLINGS.get(typeName);
  return also === undefined ? typeName : `(?:${[typeName, ...also].join('|')})`;
}

/** Whether `spelling` is a convertible alternative to `typeName`, not the name itself. */
export function isConvertedSpelling(typeName: string, spelling: string): boolean {
  return CONVERTIBLE_SPELLINGS.get(typeName)?.includes(spelling) ?? false;
}

/** The constructor name a composite literal opens with, or `''` when it opens with none. */
export function compositeTypeName(literal: string): string {
  return /^\s*([A-Za-z0-9_]+)\s*\(/.exec(literal)?.[1] ?? '';
}
