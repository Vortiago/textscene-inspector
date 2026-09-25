/**
 * Property names Godot still accepts under a pre-4.0 spelling: a `DISABLE_DEPRECATED` `_set` arm
 * forwards the old name to the current setter (`animated_sprite_2d.cpp:616-618`), so every reader
 * here treats it as the same field. `_setv` (`object.h:429-437`) calls `m_inherits::_setv` first,
 * so an alias on a base applies to every descendant, and the lookup walks `CLASS_BASE_TYPES` up.
 */

import { findRow } from './deprecatedTable.js';

/**
 * A property line as the engine stores it, which the parser, linter and renderer all read.
 * `StrictTscnParser` looks a validator up under the written key and, where none claims it, under
 * the resolved pair, naming both. No slice registers a validator under a deprecated spelling.
 */
export interface ResolvedProperty {
  readonly key: string;
  readonly value: string;
}

/**
 * The slot and literal `key = rawValue` writes on `nodeType`. A gated arm returns false for some
 * values, so `_setv` drops the write: such a value stays under its own spelling, where the linter
 * still sees it. A transforming arm hands the setter another value (`extents` doubles into `size`).
 * A section with no type (`[resource]`, an instanced node) declares no class and aliases nothing.
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

/** The property `key` writes on `nodeType`: {@link resolveDeprecatedProperty}'s key alone. */
export function canonicalPropertyName(nodeType: string | undefined, key: string, rawValue: string): string {
  return resolveDeprecatedProperty(nodeType, key, rawValue).key;
}

/** Whether `key` is a deprecated spelling on `nodeType` or an ancestor. */
export function isDeprecatedPropertyName(nodeType: string | undefined, key: string): boolean {
  return findRow(nodeType, key) !== undefined;
}

/**
 * A raw property bag with every deprecated key resolved, for the merge that learns an instance
 * override's type after the scan. A bag with both spellings keeps the one written last, the
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
