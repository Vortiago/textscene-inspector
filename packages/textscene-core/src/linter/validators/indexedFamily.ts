/**
 * One dispatcher for Godot's indexed property arrays (`item_0/text`, `option_2/name`).
 *
 * `PropertyListHelper` names each key `vformat("%s%d/%s", prefix, i, name)`
 * (`property_list_helper.cpp:149`), so the index is GLUED to the prefix with no
 * separator. Six slices each hand-rolled the same parse: match the key, reject an
 * unrecognised shape, reject a negative index, look up the leaf, forward. This is
 * that parse, once.
 *
 * It mirrors the engine's own resolution (`PropertyListHelper::_get_property`,
 * `property_list_helper.cpp:47-58`): split at the last `/`, require the head to
 * start with the prefix, require the rest to be an integer, refuse a negative one.
 * The high end (index at or past the live element count) is deliberately NOT
 * checked: that is a bound against a sibling count no per-property validator can
 * see, which ADR-0032 leaves to a semantic rule.
 *
 * Citations stay at the CALL SITE, passed in rather than written here, for two
 * reasons: each class enforces at its own `file:line`, and
 * `rangeAdvisoryGrounding.test.ts` scrapes `cite: '…'` literals out of source, so
 * a helper that owned the citation would blind that check everywhere at once.
 */

import { propertyError } from './propertyError.js';
import { accepts } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';

export interface IndexedFamilyOptions {
  /** The glued prefix, e.g. `item_` for `item_0/text`, `popup/item_` for MenuButton. */
  prefix: string;
  /** Leaf name to validator, e.g. `{ text: v.quotedString('text') }`. */
  leaves: Readonly<Record<string, PropertyValidator>>;
  /** Error code for a key whose shape or leaf name is unrecognised. */
  unknownCode: string;
  /** What this family accepts, for the generated sheet's Accepts column. */
  describes: string;
  /**
   * The negative-index branch, when the class routes writes through the helper
   * that refuses one. Omit where a slice covers the index range with a semantic
   * rule instead (FileDialog does), which leaves the dispatcher format-only.
   */
  negativeIndex?: {
    /** `file:line` of the guard that refuses it. Pass a literal, not a variable. */
    cite: string;
    /** Message for the rejected index, so each class keeps its own wording. */
    message: (index: number) => string;
    /** Error code for the negative-index branch. */
    code: string;
  };
}

/**
 * Build the dispatcher, with `leaves` exposed so `boundGrounding`'s sweep
 * recurses past it: a tag on the dispatcher says nothing about the bounds behind
 * it, and a dispatcher vouching for its own leaves is how an ungrounded bound
 * hides.
 */
export function indexedFamilyValidator(opts: IndexedFamilyOptions): PropertyValidator {
  const { prefix, leaves, unknownCode, describes, negativeIndex } = opts;

  const validator = accepts((key, value, line) => {
    const slash = key.lastIndexOf('/');
    const indexText = slash > prefix.length ? key.slice(prefix.length, slash) : '';
    const leafName = key.slice(slash + 1);
    const unknown = (): ReturnType<PropertyValidator> =>
      propertyError(key, line, `Unknown ${describes} property: "${key}"`, unknownCode);

    if (!key.startsWith(prefix) || indexText === '' || leafName === '') return unknown();
    if (!/^-?\d+$/.test(indexText)) return unknown();

    const index = Number(indexText);
    if (index < 0) {
      // Godot's helper refuses to RESOLVE a negative index, so `_set` treats the
      // key as unrecognised and the write never lands.
      if (!negativeIndex) return unknown();
      return propertyError(key, line, negativeIndex.message(index), negativeIndex.code);
    }

    const leaf = leaves[leafName];
    if (!leaf) return unknown();
    return leaf(key, value, line);
  }, describes);

  if (negativeIndex) {
    validator.grounding = { kind: 'enforced', cite: negativeIndex.cite };
  } else {
    // Only an unrecognised key shape or leaf name is rejected, which is a format
    // concern; every magnitude bound lives in the leaves.
    validator.formatOnly = true;
  }
  validator.leaves = Object.values(leaves);
  return validator;
}
