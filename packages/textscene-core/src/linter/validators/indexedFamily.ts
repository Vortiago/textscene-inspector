/**
 * One dispatcher for Godot's indexed property arrays (`item_0/text`, `option_2/name`), keyed
 * `vformat("%s%d/%s", prefix, i, name)` (`property_list_helper.cpp:149`) with the index glued to
 * the prefix. The high end (an index past the live element count) is a bound against a sibling
 * count no property validator sees, so ADR-0032 leaves it to a semantic rule.
 */

import { keyShapeError } from './propertyError.js';
import { accepts } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';
import { IS_VALID_INT_RE, stringToInt, type IndexParse } from '../../godot/index.js';
import { writtenIndex } from '../reportedIndices.js';

/**
 * The `is_valid_int` gate, the one cite this file owns since every `PropertyListHelper` family
 * shares it: `_get_property` returns nullptr and the write is dropped, ADR-0032's error tier.
 * Each class passes its own cites as `cite: '…'` literals, which `rangeAdvisoryGrounding.test.ts`
 * scrapes out of source.
 */
const IS_VALID_INT_CITE = 'property_list_helper.cpp:53-55';

export interface IndexedFamilyOptions {
  /** The glued prefix: `item_` for `item_0/text`, `popup/item_` for MenuButton. */
  prefix: string;
  /**
   * Leaf name to validator, for example `{ text: v.quotedString('text') }`. A nested leaf is
   * keyed by its full path below the index: `'apply/transform_mode'` matches
   * `settings/0/apply/transform_mode`. Both wildcard shapes, `<prefix>#/*` and `<prefix>*`
   * (`wildcardIndex.ts`), route any depth, so depth is this dispatcher's question alone.
   */
  leaves: Readonly<Record<string, PropertyValidator>>;
  /** Error code for a key whose shape or leaf name is unrecognised. */
  unknownCode: string;
  /**
   * Which of Godot's two index parses this class uses. `'is_valid_int'`, every `PropertyListHelper`
   * family, drops the write unless the index `is_valid_int()` (`property_list_helper.cpp:53-55`).
   * `'to_int'`, a hand-rolled `_set`'s bare `get_slicec('/', 1).to_int()`, skips non-digits
   * (`ustring.cpp:2268-2298`), so `"a1b2"` lands on 12 and only the leaf lookup can refuse.
   */
  // State it explicitly, with the `file:line` of the class's own `_set`: a taken default reads
  // the same as an unchecked one. A negative index is refused under both parses
  // (`property_list_helper.cpp:58` and each class's own `ERR_FAIL_INDEX_V`).
  indexParse: IndexParse;
  /**
   * The family's noun, spliced into `Unknown <describes> property: "…"`. Keep it
   * a bare singular noun (`setting`, `item`, `filter`), since it reads as prose.
   */
  describes: string;
  /**
   * What this family accepts, for the generated sheet's Accepts column, defaulting to
   * {@link describes}. Separate because the generator drops it into a Markdown table cell
   * (`lintCoverage.mjs:131`), where the `<i>` of `settings/<i>/<leaf>` opens italics.
   */
  accepts?: string;
  /**
   * The negative-index branch, when the class's helper refuses one. Omitted, the key still
   * reports as unrecognised, naming the leaf. A slice whose semantic rule also claims the
   * negative band must not declare it, or one refusal reports twice.
   */
  negativeIndex?: {
    /** `file:line` of the guard that refuses it. Pass a literal, not a variable. */
    cite: string;
    /**
     * Message for the rejected index, so each class keeps its own wording. It receives the index
     * as {@link writtenIndex} spells it: the key's text, and what Godot stores where they differ.
     */
    message: (index: string) => string;
    /** Error code for the negative-index branch. */
    code: string;
  };
}

/**
 * Build the dispatcher, with `leaves` exposed so `boundGrounding`'s sweep
 * recurses past it: a tag on the dispatcher says nothing about the bounds behind
 * it.
 */
export function indexedFamilyValidator(opts: IndexedFamilyOptions): PropertyValidator {
  const { prefix, leaves, unknownCode, describes, negativeIndex } = opts;
  const gatesOnValidInt = opts.indexParse === 'is_valid_int';

  // Hoisted out of the per-call body, which runs once per `<prefix><i>/<leaf>`
  // key: one closure per registered family, not one per call.
  const unknown = (key: string, line: number): ReturnType<PropertyValidator> =>
    keyShapeError(key, line, `Unknown ${describes} property: "${key}"`, unknownCode);

  /**
   * The leaf names whose branch reads a segment below itself: `end_bone`, since
   * `end_bone/direction` is declared beside it. Such a branch returns false for
   * an option it does not know (two_bone_ik_3d.cpp:69), so only a terminal
   * branch swallows a tail.
   */
  const readsDeeper = new Set<string>();
  for (const name of Object.keys(leaves)) {
    for (let cut = name.indexOf('/'); cut >= 0; cut = name.indexOf('/', cut + 1)) {
      readsDeeper.add(name.slice(0, cut));
    }
  }

  /**
   * The declared leaf a hand-rolled `_set` reaches for. `get_slicec('/', n)` ignores what follows
   * its segment, so `settings/0/root_bone/extra` calls `set_root_bone` (bone_twist_disperser_3d.cpp:37-40).
   * Cutting from the right keeps a two-segment leaf at its own depth
   * (`settings/<i>/<where>/<what>`, convert_transform_modifier_3d.cpp:37-40).
   */
  const declaredLeaf = (leafName: string): string => {
    if (Object.prototype.hasOwnProperty.call(leaves, leafName)) return leafName;
    let candidate = leafName;
    for (;;) {
      // `PropertyListHelper` cuts at the last `/` too (property_list_helper.cpp:47),
      // but there a trailing segment fails `is_valid_int`, and that family
      // reports the whole remainder unknown.
      const cut = candidate.lastIndexOf('/');
      if (cut < 0) return leafName;
      candidate = candidate.slice(0, cut);
      if (Object.prototype.hasOwnProperty.call(leaves, candidate) && !readsDeeper.has(candidate)) {
        return candidate;
      }
    }
  };

  const validator = accepts((key, value, line) => {
    // The first `/` past the prefix ends the index, and the rest is the leaf: a
    // hand-rolled override nests deeper than `PropertyListHelper`'s one segment
    // (`property_list_helper.cpp:47`), as `TwoBoneIK3D`'s
    // `settings/<i>/end_bone/direction` does.
    const slash = key.indexOf('/', prefix.length);
    const indexText = slash < 0 ? '' : key.slice(prefix.length, slash);
    const leafName = slash < 0 ? '' : key.slice(slash + 1);
    if (!key.startsWith(prefix) || indexText === '' || leafName === '') {
      return unknown(key, line);
    }

    // A class that gates on `is_valid_int` has no index at all for text the
    // regex rejects, so the key is unrecognised before an index is ever read.
    if (gatesOnValidInt && !IS_VALID_INT_RE.test(indexText)) return unknown(key, line);
    // The index Godot stores: `to_int` reads `settings/a-1/…` as -1 (ustring.cpp:2291-2292), and
    // the `int` keeps the low 32 bits, so `2147483648` is negative and `4294967296` is 0.
    const index = stringToInt(indexText);
    if (index < 0) {
      // Godot refuses to resolve a negative index under either parse, so
      // `_set` treats the key as unrecognised and the write never lands.
      if (!negativeIndex) return unknown(key, line);
      const named = writtenIndex(indexText, index);
      return keyShapeError(key, line, negativeIndex.message(named), negativeIndex.code);
    }
    // A non-negative index resolves to some setting and the write lands, so only
    // the leaf can still be refused.
    const resolved = gatesOnValidInt ? leafName : declaredLeaf(leafName);
    // hasOwnProperty, so a leaf named `toString` cannot resolve an inherited
    // function and get called as a validator.
    if (!Object.prototype.hasOwnProperty.call(leaves, resolved)) return unknown(key, line);
    const leaf = leaves[resolved];
    if (!leaf) return unknown(key, line);
    // A leaf whose own path carries an index is a nested family (`ChainIK3D`'s
    // `settings/<i>/joints/<j>/bone`, chain_ik_3d.cpp), matched by its slice's own regex through
    // {@link stringToInt}. Absorbing one needs a sub-path that ends in an index
    // (`SpringBoneSimulator3D`'s `collisions/<j>`) and a `negativeIndex` per index position.
    return leaf(key, value, line);
  }, opts.accepts ?? describes);

  const cites = [
    // The index gate ({@link IS_VALID_INT_CITE}) refuses a real value, so an
    // `is_valid_int` family is grounded with or without a negative-index branch.
    ...(gatesOnValidInt ? [IS_VALID_INT_CITE] : []),
    ...(negativeIndex ? [negativeIndex.cite] : []),
  ];
  if (cites.length > 0) {
    // Two cites where two guards can fire, the way `patternValidator` names
    // both of TileSet's (`resources/tileset/sourceValidators.ts`).
    validator.grounding = { kind: 'enforced', cite: cites.join(', ') };
  } else {
    // A `to_int` class resolves every index text to some element, so nothing
    // above refuses a real value: only an unrecognised key shape or leaf name
    // is rejected. Every magnitude bound lives in the leaves.
    validator.formatOnly = true;
  }
  validator.leaves = Object.values(leaves);
  return validator;
}
