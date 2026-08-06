/**
 * One dispatcher for Godot's indexed property arrays (`item_0/text`, `option_2/name`).
 *
 * `PropertyListHelper` names each key `vformat("%s%d/%s", prefix, i, name)`
 * (`property_list_helper.cpp:149`), so the index is GLUED to the prefix with no
 * separator. Six slices each hand-rolled the same parse: match the key, reject an
 * unrecognised shape, reject a negative index, look up the leaf, forward. This is
 * that parse, once.
 *
 * It mirrors the engine's own resolution: require the head to start with the
 * prefix, read the index that follows, refuse a negative one, look the leaf up.
 * Godot has TWO such resolutions and they disagree about a non-numeric index, so
 * which one a class uses is the `indexParse` option rather than a constant here.
 * The high end (index at or past the live element count) is deliberately NOT
 * checked under either: that is a bound against a sibling count no per-property
 * validator can see, which ADR-0032 leaves to a semantic rule.
 *
 * ## A leaf may be more than one segment
 *
 * The index ends at the FIRST `/` after the prefix, and EVERYTHING after that
 * slash is the leaf name. `PropertyListHelper` only ever writes a one-segment
 * leaf (`rsplit("/", true, 1)`, `property_list_helper.cpp:47`), but the classes
 * that build an indexed family by hand do not: a `get_property_list` override
 * composes its own path, and `ConvertTransformModifier3D`
 * (`settings/<i>/apply/transform_mode`) and `TwoBoneIK3D`
 * (`settings/<i>/end_bone/direction`) both nest one level deeper. Splitting at
 * the LAST `/` instead read an index of `0/apply`, so the key matched no leaf
 * and every value on it was silently accepted.
 *
 * A nested leaf is declared by naming it in full: `'apply/transform_mode'`, the
 * whole path below the index. Depth is not otherwise special-cased, so a family
 * declaring only flat leaves behaves exactly as before.
 *
 * What this does NOT reach is a leaf whose own path carries an index, such as
 * `ChainIK3D`'s `settings/<i>/joints/<j>/bone` (chain_ik_3d.cpp) or
 * `IterateIK3D`'s `settings/<i>/joints/<j>/<leaf>`. Those are a nested indexed
 * FAMILY, not a static multi-segment leaf name, and four slices still match them
 * with a regex of their own (`chainik3d`, `iterateik3d`, `springbonesimulator3d`,
 * `bonetwistdisperser3d`).
 *
 * Absorbing them is deliberately NOT done here yet, and any attempt must satisfy
 * two constraints the obvious `{ nested: { prefix, leaves } }` shape misses:
 *
 * 1. **A sub-path may terminate in an INDEX, with no leaf below it.**
 *    `SpringBoneSimulator3D` addresses `settings/<i>/collisions/<j>` — nothing
 *    follows the second index. This dispatcher requires a non-empty leaf name
 *    and resolves by leaf NAME, so a nested option shaped around
 *    `joints/<j>/<leaf>` still cannot express it.
 * 2. **Each index position needs its OWN `negativeIndex`.**
 *    `BoneTwistDisperser3D` reports a negative setting index and a negative joint
 *    index with different messages and different codes. One block cannot carry
 *    both.
 *
 * Also worth settling first: `chainik3d` matches its joint index with `\d`, while
 * the other three use `[^/]+` because `to_int` resolves a non-numeric index. That
 * is the same reasoning reaching two answers inside one family.
 *
 * Citations stay at the CALL SITE, passed in rather than written here, for two
 * reasons: each class enforces at its own `file:line`, and
 * `rangeAdvisoryGrounding.test.ts` scrapes `cite: '…'` literals out of source, so
 * a helper that owned the citation would blind that check everywhere at once.
 */

import { propertyError } from './propertyError.js';
import { accepts } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';
import { IS_VALID_INT_RE } from '../../godot/index.js';

export interface IndexedFamilyOptions {
  /** The glued prefix, e.g. `item_` for `item_0/text`, `popup/item_` for MenuButton. */
  prefix: string;
  /**
   * Leaf name to validator, e.g. `{ text: v.quotedString('text') }`.
   *
   * A NESTED leaf is keyed by its full path below the index —
   * `{ 'apply/transform_mode': … }` matches `settings/0/apply/transform_mode`.
   *
   * A family with a nested leaf must register under the PLAIN `<prefix>*`
   * wildcard, not the glued-index `<prefix>#/*`: `ValidatorRegistry`'s
   * `matchesIndexedKey` routes a single leaf segment only, so a nested key
   * registered under `#/*` reaches this dispatcher never and is silently
   * accepted. `TwoBoneIK3D`, `IterateIK3D` and `ChainIK3D` already register the
   * plain form for that reason.
   */
  leaves: Readonly<Record<string, PropertyValidator>>;
  /** Error code for a key whose shape or leaf name is unrecognised. */
  unknownCode: string;
  /**
   * Which of Godot's TWO index parses this class uses. They disagree about a
   * non-numeric index, and the disagreement is a real difference between two
   * engine code paths rather than a style choice:
   *
   * - `'is_valid_int'` (the default) — `PropertyListHelper::_get_property`
   *   returns `nullptr` unless the index `is_valid_int()`
   *   (`property_list_helper.cpp:53-55`), so `_set` returns false and the write
   *   is DROPPED. `item_x/text` is a key Godot refuses, and rejecting it is
   *   grounded. Every `PropertyListHelper` family is this one: ItemList,
   *   PopupMenu, OptionButton, MenuButton, TabBar, FileDialog.
   * - `'to_int'` — a class that hand-rolls `_set` reads the index with a bare
   *   `path.get_slicec('/', 1).to_int()` and no validity gate, and `_to_int`
   *   SKIPS non-digits rather than stopping at them (`ustring.cpp:2268-2298`),
   *   so `"x"` resolves to 0 and `"a1b2"` to 12 and the write LANDS on that
   *   setting. Nothing refuses the value, so ADR-0032 grounds no diagnostic and
   *   the index is left alone; the leaf lookup below still decides, because an
   *   unrecognised leaf is dropped whatever the index resolved to. The whole
   *   BoneConstraint3D and IK `settings/` family is this one.
   *
   * A negative index is refused under BOTH parses (`property_list_helper.cpp:58`
   * and each class's own `ERR_FAIL_INDEX_V`), so `negativeIndex` is unaffected.
   *
   * STATE IT EXPLICITLY, with the `file:line` of the class's own `_set`. Every
   * consumer does, default or not, because taking the default is indistinguishable
   * from never having checked: BoneConstraint3D read the index with a bare
   * `to_int` and carried the `is_valid_int` default for as long as the registry's
   * matcher declined to route a non-numeric index, and the day it routed one the
   * slice would have rejected a write Godot applies.
   */
  indexParse?: 'is_valid_int' | 'to_int';
  /**
   * The family's noun, spliced into `Unknown <describes> property: "…"`. Keep it
   * a bare singular noun (`setting`, `item`, `filter`) — it reads as prose.
   */
  describes: string;
  /**
   * What this family accepts, for the generated sheet's Accepts column,
   * defaulting to {@link describes}.
   *
   * Separate because the two audiences want different text and one of them is
   * MARKDOWN: the sheet generator drops this straight into a table cell
   * (`lintCoverage.mjs:131`), where the `<i>` of a natural key shape like
   * `settings/<i>/<leaf>` opens italics and eats the rest of the row. Two slices
   * reassigned `.accepts` after construction to work around the conflation
   * before this existed.
   */
  accepts?: string;
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
  const gatesOnValidInt = (opts.indexParse ?? 'is_valid_int') === 'is_valid_int';

  // Both hoisted out of the per-call body. This dispatcher runs once per
  // `<prefix><i>/<leaf>` key, and a single SpringBoneSimulator3D carries about
  // forty of them per setting, so a closure and a RegExp object per call are
  // paid on the success path too. One closure per registered family instead.
  const unknown = (key: string, line: number): ReturnType<PropertyValidator> =>
    propertyError(key, line, `Unknown ${describes} property: "${key}"`, unknownCode);

  const validator = accepts((key, value, line) => {
    // The FIRST `/` past the prefix, so a leaf may itself contain one. The last
    // `/` would swallow `apply` into the index and `settings/0/apply/axis` would
    // resolve to nothing.
    const slash = key.indexOf('/', prefix.length);
    const indexText = slash < 0 ? '' : key.slice(prefix.length, slash);
    const leafName = slash < 0 ? '' : key.slice(slash + 1);
    if (!key.startsWith(prefix) || indexText === '' || leafName === '') {
      return unknown(key, line);
    }

    if (IS_VALID_INT_RE.test(indexText)) {
      const index = Number(indexText);
      if (index < 0) {
        // Godot refuses to RESOLVE a negative index under either parse, so
        // `_set` treats the key as unrecognised and the write never lands.
        if (!negativeIndex) return unknown(key, line);
        return propertyError(key, line, negativeIndex.message(index), negativeIndex.code);
      }
    } else if (gatesOnValidInt) {
      return unknown(key, line);
    }
    // Under `to_int` a non-numeric index falls through uncommented-on: it
    // resolves to SOME setting and the write lands, so the leaf below is the
    // only thing left that Godot can refuse.

    // hasOwnProperty, so a leaf named `toString` cannot resolve an inherited
    // function and get called as a validator.
    if (!Object.prototype.hasOwnProperty.call(leaves, leafName)) return unknown(key, line);
    const leaf = leaves[leafName];
    if (!leaf) return unknown(key, line);
    return leaf(key, value, line);
  }, opts.accepts ?? describes);

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
