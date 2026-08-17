/**
 * Property names Godot still accepts under their pre-4.0 spelling.
 *
 * A `#ifndef DISABLE_DEPRECATED` `_set` override forwards the old name to the
 * current setter and returns `true`, so the file loads and the property takes
 * effect — `AnimatedSprite2D::_set` (`animated_sprite_2d.cpp:616-618`) hands
 * `frames` straight to `set_sprite_frames`. To every reader in this codebase
 * the old spelling is simply the same field under another name.
 *
 * Complete for `scene/` at 4.6.3: grepping every `::_set` override in that tree
 * for a `p_name == SNAME(...)` comparison yields exactly these four. They are
 * listed rather than derived because the repo must not read engine source at
 * build or test time.
 *
 * One table, because the alias is not a linter concern: the previewer draws
 * `frames = SubResource("…")` only if its parser resolves the name, and the
 * linter reported "Godot clears 'animation'" on 25 scenes across two shipped
 * projects precisely because its rule read the canonical key alone.
 */

/**
 * `Type.deprecated` to the property the setter actually writes.
 *
 * A `Map` of `Map`s, not object literals: both keys come from a `.tscn`, and a
 * plain object answers `constructor`/`__proto__`/`toString` from its prototype.
 * That returned a FUNCTION where the signature promises a string, and the
 * linter threw `propertyKey.startsWith is not a function` on a four-line scene.
 */
const DEPRECATED_PROPERTY_NAMES = toLookup({
  // `set_sprite_frames`, both dimensions.
  AnimatedSprite2D: { frames: 'sprite_frames' }, // animated_sprite_2d.cpp:616-618
  AnimatedSprite3D: { frames: 'sprite_frames' }, // sprite_3d.cpp:1494-1496
  // `set_horizontal_alignment` / `set_vertical_alignment`.
  Label: { align: 'horizontal_alignment', valign: 'vertical_alignment' }, // label.cpp:1002-1007
});

/** Nested plain literals to nested Maps, so no lookup can reach a prototype. */
function toLookup(table: Record<string, Record<string, string>>): Map<string, Map<string, string>> {
  return new Map(Object.entries(table).map(([type, keys]) => [type, new Map(Object.entries(keys))]));
}

/**
 * The property `key` writes on `nodeType`, which is `key` itself unless the
 * type carries a deprecated alias for it.
 *
 * Only the type's OWN table is consulted, never an ancestor's: `_set` is a
 * virtual on the declaring class, so `Label`'s `align` says nothing about any
 * other Control.
 */
export function canonicalPropertyName(nodeType: string | undefined, key: string): string {
  // A section with no type — `[resource]`, or a heading whose `type=` is absent
  // because the node is instantiated — declares no class, so it aliases nothing.
  if (nodeType === undefined) return key;
  return DEPRECATED_PROPERTY_NAMES.get(nodeType)?.get(key) ?? key;
}

/** Whether `key` is a deprecated spelling on `nodeType`. */
export function isDeprecatedPropertyName(nodeType: string | undefined, key: string): boolean {
  return nodeType !== undefined && DEPRECATED_PROPERTY_NAMES.get(nodeType)?.get(key) !== undefined;
}
