/**
 * Composite spellings a property slot accepts besides its own type name.
 *
 * `Variant::can_convert_strict` (`variant.cpp:536-830`) decides whether a value
 * may be written to a property of a different type. The write goes through
 * `VariantCaster<T>::cast` (`binder_common.h:223`), so the conversion is real:
 * `SubViewport.size = Vector2(1920, 1080)` is a file Godot opens, storing
 * `Vector2i(1920, 1080)`. Measured on 4.6.3.
 *
 * Only the SAME-ARITY pairs are here, and deliberately so. The full table also
 * permits reshaping conversions — `Transform2D`(6) → `Transform3D`(12),
 * `Quaternion`(4) ↔ `Basis`(9), `Projection`(16) ← `Transform3D`(12) — and a
 * conversion that rebuilds a matrix from a quaternion is a different change
 * from widening an alternation. No scene in a 9,626-file survey of 99 public
 * repositories used one; every measured false positive was a same-arity pair.
 * The string family (`String` ↔ `StringName` ↔ `NodePath`, `Color` ← `String`)
 * is likewise out: those are not tuple grammars and share no builder.
 *
 * One table for BOTH grammar builders. The linter's `makeFloatTupleRegex` and
 * the renderer's `finiteTupleRegex` differ only in whether a component may be
 * non-finite; if they disagreed on the type NAME as well, the previewer would
 * fall back to a default for a spelling the linter accepts — which is the
 * divergence the whole grammar-guard family exists to prevent. Measured before
 * this table existed: `size = Vector2(1920, 1080)` drew a 512x512 viewport.
 */

/** Same-arity conversions, keyed by the slot's declared type. */
const CONVERTIBLE_SPELLINGS: Readonly<Record<string, readonly string[]>> = {
  Vector2: ['Vector2i'],
  Vector2i: ['Vector2'],
  Vector3: ['Vector3i'],
  Vector3i: ['Vector3'],
  Vector4: ['Vector4i'],
  Vector4i: ['Vector4'],
  Rect2: ['Rect2i'],
  Rect2i: ['Rect2'],
};

/**
 * The regex alternation matching every spelling a `typeName` slot accepts —
 * the type's own name first, so a canonical value matches on the first branch.
 *
 * Returns the bare name for a type with no conversions, so a builder can
 * interpolate the result unconditionally.
 */
export function compositeSpellings(typeName: string): string {
  const also = CONVERTIBLE_SPELLINGS[typeName];
  return also === undefined ? typeName : `(?:${[typeName, ...also].join('|')})`;
}

/** Whether `spelling` is a convertible alternative to `typeName`, not the name itself. */
export function isConvertedSpelling(typeName: string, spelling: string): boolean {
  return CONVERTIBLE_SPELLINGS[typeName]?.includes(spelling) ?? false;
}
