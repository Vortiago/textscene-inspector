/**
 * Property names Godot still accepts under their pre-4.0 spelling.
 *
 * A `#ifndef DISABLE_DEPRECATED` `_set` override forwards the old name to the
 * current setter and returns `true`, so the file loads and the property takes
 * effect — `AnimatedSprite2D::_set` (`animated_sprite_2d.cpp:616-618`) hands
 * `frames` straight to `set_sprite_frames`. To every reader in this codebase
 * the old spelling is simply the same field under another name.
 *
 * Three shapes of arm, and a row expresses each:
 * - a PURE RENAME passes `p_value` through untouched;
 * - a GATED arm forwards only some values and returns false for the rest, so
 *   `_setv` finds nothing under the deprecated name and the write is DROPPED
 *   (`RichTextLabel::bbcode_text` refuses an empty string; `PointLight2D::mode`
 *   a non-number; the `bool(p_value)` arms a falsy one). The row's `applies`
 *   is that test, and the lookup takes the value for it;
 * - a TRANSFORMING arm hands the setter a different value (`extents` doubles
 *   into `size`, `expand = true` becomes `expand_mode = 1`). The row's
 *   `transform` rewrites the raw literal, and `resolveDeprecatedProperty`
 *   returns key and value together so parser, linter rules and renderer all
 *   read what the engine stores.
 *
 * SCOPE: `_setv` (`object.h:429-437`) calls `m_inherits::_setv` FIRST, so an
 * alias declared on a base class applies to every descendant. The lookup walks
 * `CLASS_BASE_TYPES` from the node's own type upward, which is what puts
 * `GeometryInstance3D`'s `use_in_baked_light` on a `MeshInstance3D`.
 *
 * Applied to the PROPERTY BAG and to the linter's validator lookup:
 * `StrictTscnParser` looks a validator up under the key as written and, where
 * nothing claims that spelling, under the resolved pair, naming both keys in
 * the diagnostic. No slice registers a validator under a deprecated spelling;
 * the canonical validator is the single wording.
 *
 * A slice that ALREADY handles its own alias is not listed here, because two
 * mechanisms for one alias is worse than either. `AnimationPlayer` reads
 * `active ?? playback_active` in its parser and registers validators under the
 * deprecated names, so it keeps its own precedence and its own messages.
 *
 * The list comes from walking every `::_set` body in `scene/` for either
 * `p_name == "…"` spelling, not from grepping `SNAME`: most overrides compare
 * against a bare string literal.
 */

import { findRow } from './deprecatedTable.js';

/** A property line as the engine stores it: the slot written and the literal it receives. */
export interface ResolvedProperty {
  readonly key: string;
  readonly value: string;
}

/**
 * The slot and literal `key = rawValue` writes on `nodeType`, which is the pair
 * itself unless the type (or an ancestor) carries a deprecated alias for it.
 *
 * A section with no type — `[resource]`, or a heading whose `type=` is absent
 * because the node is instantiated — declares no class, so it aliases nothing.
 * An arm whose `applies` refuses the value is left under its own spelling: that
 * keeps it out of the canonical slot while the linter still sees the text the
 * scene carries.
 */
export function resolveDeprecatedProperty(
  nodeType: string | undefined,
  key: string,
  rawValue: string
): ResolvedProperty {
  const row = findRow(nodeType, key);
  if (row === undefined) return { key, value: rawValue };
  if (typeof row === 'string') return { key: row, value: rawValue };
  if (row.applies !== undefined && !row.applies(rawValue)) return { key, value: rawValue };
  return { key: row.to, value: row.transform ? row.transform(rawValue) : rawValue };
}

/** The property `key` writes on `nodeType` — {@link resolveDeprecatedProperty}'s key alone. */
export function canonicalPropertyName(nodeType: string | undefined, key: string, rawValue: string): string {
  return resolveDeprecatedProperty(nodeType, key, rawValue).key;
}

/** Whether `key` is a deprecated spelling on `nodeType` or an ancestor. */
export function isDeprecatedPropertyName(nodeType: string | undefined, key: string): boolean {
  return findRow(nodeType, key) !== undefined;
}

/**
 * A raw property bag with every deprecated key resolved to what it writes.
 *
 * For the seams that learn the node's type LATER than the scan did: an
 * `[node ... instance=ExtResource("1")]` heading carries no `type=`, so the
 * scanner cannot resolve an alias in an instance override, but the merge that
 * layers that override onto the instanced root's own properties does know the
 * type. A bag carrying BOTH spellings keeps the one written last, which is the
 * order `_setv` applies them in. Returns `raw` itself when nothing resolved.
 */
export function canonicalisePropertyBag(
  nodeType: string | undefined,
  raw: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {};
  let changed = false;
  for (const [key, value] of Object.entries(raw)) {
    const resolved = resolveDeprecatedProperty(nodeType, key, value);
    changed ||= resolved.key !== key || resolved.value !== value;
    out[resolved.key] = resolved.value;
  }
  return changed ? out : raw;
}
