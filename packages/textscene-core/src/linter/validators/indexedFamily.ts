import { keyShapeError } from './propertyError.js';
import { accepts } from './v.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';
import {
  declaredLeafResolver,
  parsePropertyIndex,
  type IndexParse,
  type LeafResolver,
} from '../../godot/classdb/indexedKey.js';
import type { IndexedFamily } from '../../godot/classdb/indexedFamily.js';
import { negativeIndexError } from '../reportedIndices.js';

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
  indexParse: IndexParse;
  /** The first index for which the engine binds no property. */
  indexLimit?: { readonly value: number; readonly at: string };
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
     * as `writtenIndex` spells it: the key's text, and what Godot stores where they differ.
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
  const source = opts.indexLimit ? ` (${opts.indexLimit.at})` : '';
  const unknown = (key: string, line: number): ReturnType<PropertyValidator> =>
    keyShapeError(key, line, `Unknown ${describes} property: "${key}"${source}`, unknownCode);

  const resolveLeaf: LeafResolver =
    opts.indexParse !== 'to_int'
      ? (leafName) => (Object.prototype.hasOwnProperty.call(leaves, leafName) ? leafName : null)
      : declaredLeafResolver(Object.keys(leaves));

  const validator = accepts((key, value, line) => {
    const slash = key.indexOf('/', prefix.length);
    if (!key.startsWith(prefix) || slash < 0) return unknown(key, line);
    const indexText = key.slice(prefix.length, slash);
    const leafName = key.slice(slash + 1);
    if (leafName === '') return unknown(key, line);

    const index = parsePropertyIndex(indexText, opts.indexParse);
    if (index === null) return unknown(key, line);
    if (index < 0) {
      return negativeIndex
        ? negativeIndexError(indexText, key, line, negativeIndex.message, negativeIndex.code)
        : unknown(key, line);
    }
    if (opts.indexLimit && index >= opts.indexLimit.value) return unknown(key, line);
    const resolved = resolveLeaf(leafName);
    if (resolved === null) return unknown(key, line);
    return leaves[resolved]!(key, value, line);
  }, opts.accepts ?? describes);

  const cites = [
    // The index gate ({@link IS_VALID_INT_CITE}) refuses a real value, so an
    // `is_valid_int` family is grounded with or without a negative-index branch.
    ...(gatesOnValidInt ? [IS_VALID_INT_CITE] : []),
    ...(negativeIndex ? [negativeIndex.cite] : []),
    ...(opts.indexLimit ? [opts.indexLimit.at] : []),
  ];
  if (cites.length > 0) {
    validator.grounding = { kind: 'enforced', cite: cites.join(', ') };
  } else {
    validator.formatOnly = true;
  }
  validator.leaves = Object.values(leaves);
  return validator;
}

/**
 * The registry entry of a declared family: its validator under the key that routes
 * `<prefix><i>/<leaf>` to it. `#` selects the glued-index matcher of
 * `ValidatorRegistry.findOwnValidator`. The prefix and index parse come from the declaration.
 */
export function propertyListFamilyEntry(
  family: IndexedFamily,
  options: Omit<IndexedFamilyOptions, 'prefix' | 'indexParse'>
): Record<string, PropertyValidator> {
  const validator = indexedFamilyValidator({
    ...options,
    prefix: family.prefix,
    indexParse: family.indexParse,
  });
  return { [`${family.prefix}#/*`]: validator };
}
