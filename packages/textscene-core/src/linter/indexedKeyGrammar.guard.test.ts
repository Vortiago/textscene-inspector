/**
 * One home per index grammar, so a rule never spells Godot's again.
 *
 * Godot resolves the index in `<prefix><i>/<leaf>` two ways, and they disagree
 * in OPPOSITE directions from the `-?\d+` a hand-written rule reaches for:
 *
 * - A `PropertyListHelper` family gates on `String::is_valid_int()` before
 *   converting (`property_list_helper.cpp:53-55`), and that accepts a leading
 *   `+` as readily as a `-` (`ustring.cpp:4752`). `item_+5/text` RESOLVES, and
 *   four rules matching `-?\d+` never saw it — an out-of-range item that Godot
 *   drops went unreported.
 * - A class that builds its own property list reads the index with a bare
 *   `get_slicec('/', n).to_int()` and no validity gate at all
 *   (`bone_twist_disperser_3d.cpp:37`, `spring_bone_simulator_3d.cpp:42`,
 *   `mesh_instance_3d.cpp:113`). `to_int` SKIPS a character it cannot use
 *   rather than stopping at it and flips the sign on a `-` seen while the total
 *   is still 0, so `settings/a-1/…` names setting -1 and `settings/x/…` names
 *   setting 0. `[+-]?\d+` admits too LITTLE there: a key naming a real element
 *   never reached the rule.
 *
 * Source text rather than behaviour, deliberately: a second copy of a grammar is
 * wrong only for the spellings the two copies disagree about, and nothing
 * observes that until someone writes the fixture for one particular family.
 * Eleven rule files each owned a copy, and no two of them were wrong the same
 * way.
 *
 * There is no exemption list at either population below: `indexedKeyRegex` takes
 * a shape string with `#` at each index position, so there is no key shape it
 * cannot express — a nested index (`settings/#/joints/#/twist_amount`), an index
 * with no leaf below it (`collisions/#`) and a `:`-joined coordinate pair
 * (`(#):(#)/…`) all spell directly.
 *
 * ## Two populations, two bans
 *
 * A rule file may spell NO digit class in a regex at all, and 120 of them
 * currently spell none: the linter's value grammars go through `v` and
 * `slotTupleRegex`, so any digit class left in one is a key grammar.
 *
 * Package-wide that ban would be false. A parser or a resource decoder reads
 * VALUES as well as keys, and two of them legitimately spell a digit class in
 * one: `arraymesh/surfaceFields.ts` pulls an int field out of a serialised
 * `_surfaces` block, `animationtree/treeResources.ts` tokenises a
 * `node_connections` array. So the wider sweep bans an index SPELLING in a KEY
 * — the digit class, and the `[^/]+` segment a `to_int` family matches with —
 * identified by the path separator beside it, and the two bans live here
 * together because the difference between them is the whole point — a sibling
 * file would state half the rule twice.
 *
 * ## What source text cannot see
 *
 * A rule that never matches a key at all, and instead builds `settings/${i}/…`
 * forward from a numeric loop, reads the same grammar with no regex to find:
 * `IterateIK3D` did, and a `settings/x/target_node` the engine applies to
 * setting 0 left the rule reporting setting 0 as target-less. `indexedElements`
 * is the resolved-index scan those rules use instead, and only a behaviour test
 * holds them to it. Stated as an edge rather than contorted around.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { stripComments } from '@textscene/dev-kit';
import { allSourceFiles, srcRoot } from './testing/ruleNameScrape.js';
import { indexedKeyRegex } from '../godot/indexedKey.js';

/** A file's `src/`-relative path, the form every list below is written in. */
const label = (file: string): string => relative(srcRoot, file).replaceAll('\\', '/');

/**
 * A file that declares a phase-2 rule, by the one property a rule cannot be
 * renamed or moved out of: it hands itself to the registry.
 *
 * A `linter.ts` path roster would say the same thing today — all 120 of them
 * coincide — and would stop saying it the moment a rule moved into a sibling
 * file, which is exactly how a slice grows past the 200-LOC ceiling.
 */
const DECLARES_A_RULE = /ruleRegistry\.register\(/;

/**
 * A regex literal, and a `new RegExp` string argument, on their own terms.
 *
 * Lifted from `godotLiteralGrammar.guard.test.ts`, for the same reason it
 * extracts rather than describes: a guard that matched one spelling of the
 * offending pattern missed three a reviewer produced on the first try. Requiring
 * a CLOSING delimiter keeps prose out, and the body class excludes `\n` so a
 * match can never pair one line's `/` with another's.
 */
const REGEX_LITERAL = /\/(?![/*])((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/[dgimsuvy]*/g;
const REGEXP_CTOR = /new RegExp\(\s*(['"`])((?:[^\\]|\\.)*?)\1/g;

/**
 * A digit class, however it is spelled. `\d` is what every offending site
 * actually wrote; `[0-9]` and `\p{Nd}` are the two rewrites that say the same
 * thing, and banning the meaning rather than the character sequence is what
 * lets this carry no allowlist.
 */
const DIGIT_CLASS = /\\d|\[0-9]|\\p\{Nd\}/;

/**
 * A wildcard SEGMENT — the OTHER spelling of an index position, and the one a
 * digit-class ban cannot see.
 *
 * `to_int` refuses nothing, so a family that reads its index that way matches
 * the whole segment: `[^/]+`. Three files spelled that by hand and slid straight
 * under the term above while making exactly the claim it exists to centralise.
 * Only the negated-slash OPENING is required, so `[^/\s]` and any other
 * narrowing of the same class lands here too.
 */
const SEGMENT_CLASS = /\[\^\\?\//;

/** Character classes removed, so a `/` inside one cannot pass for a separator. */
const withoutClasses = (body: string): string => body.replace(/\[(?:[^\]\\]|\\.)*\]/g, '');

/**
 * A literal path segment: a family's own prefix or leaf, spelled out
 * (`settings\/`, `joints\/`).
 *
 * The discriminator the segment class needs and the digit class does not. A
 * digit class beside a separator can only be an index; a wildcard segment beside
 * one is an index only when the pattern also NAMES the family it indexes.
 * `generic6dofjoint3d/linterParser.ts`'s `/^[^/]+\//` names none — it strips
 * whatever the first segment is, for a group prefix Godot enumerates rather than
 * indexes — and there is no `#` for it to compose. Stated as an edge rather than
 * exempted, so the ban stays absolute for everything that does name a family.
 */
const LITERAL_SEGMENT = /\w\\?\//;

/**
 * `${…}` blanked. A prefix or a leaf name interpolated INTO a shape string is an
 * argument to the shared builder, not a grammar, and composing the builder is
 * the pattern this guard wants.
 */
const withoutInterpolations = (src: string): string => src.replace(/\$\{[^}]*\}/g, '');

/**
 * A Godot property path's separator, in either extraction's output.
 *
 * A regex LITERAL cannot hold a bare `/` — {@link REGEX_LITERAL}'s body admits
 * one only as `\/`, or inside a character class — and a `new RegExp` string
 * holds either, so testing for the character alone finds both spellings.
 */
const PATH_SEPARATOR = /\//;

/** The offending pattern text, or `null` when the file spells no digit class in a regex. */
function handRolledIndexGrammar(source: string): string | null {
  const src = withoutInterpolations(stripComments(source));
  for (const m of src.matchAll(REGEX_LITERAL)) if (DIGIT_CLASS.test(m[1]!)) return m[0];
  for (const m of src.matchAll(REGEXP_CTOR)) if (DIGIT_CLASS.test(m[2]!)) return m[0];
  return null;
}

/**
 * One extracted pattern body, judged against both index spellings.
 *
 * The two terms carry different second conditions because they are differently
 * self-evident: a digit class beside a separator can only be an index, while a
 * wildcard segment is one only where the pattern also names the family
 * ({@link LITERAL_SEGMENT}).
 */
function spellsAnIndexPosition(body: string): boolean {
  if (DIGIT_CLASS.test(body) && PATH_SEPARATOR.test(body)) return true;
  return SEGMENT_CLASS.test(body) && LITERAL_SEGMENT.test(withoutClasses(body));
}

/**
 * The same offence at the parser/decoder layer, narrowed to a KEY grammar.
 *
 * A Godot property key is `/`-separated — `get_slicec('/', n)`,
 * `split("/", true, 2)`, `rsplit("/", true, 1)` are the three readers the engine
 * uses — so a pattern spelling a separator beside either index spelling, a digit
 * class ({@link DIGIT_CLASS}) or a wildcard segment ({@link SEGMENT_CLASS}), is
 * describing an index position, whatever file it sits in. Every value grammar in
 * the package spells no separator at all, so the two sets do not overlap and
 * this needs no allowlist either.
 *
 * Two edges, stated rather than contorted around. A `res://` grammar that
 * spelled a digit class would land here wrongly — none does, and the answer then
 * is a named path builder, never an exemption. And a family whose whole key is
 * the index with no `/` at all (`TileSet`'s `pattern_5`, tile_set.cpp:3995)
 * carries no separator to find; widening the term to catch a `_`-glued index
 * would pull in every identifier character class instead.
 */
function handRolledKeyGrammar(source: string): string | null {
  const src = withoutInterpolations(stripComments(source));
  for (const m of src.matchAll(REGEX_LITERAL)) if (spellsAnIndexPosition(m[1]!)) return m[0];
  for (const m of src.matchAll(REGEXP_CTOR)) if (spellsAnIndexPosition(m[2]!)) return m[0];
  return null;
}

/**
 * Whoever builds or scans the `to_int` grammar, derived from the argument that
 * selects it rather than from a roster of file names.
 *
 * Two terms rather than one call-shaped pattern: a shape string contains its own
 * parentheses (`'^settings/(#)/'`), so any expression bounded by the closing
 * paren stopped inside the first argument and saw three of the seven files.
 */
const COMPOSES_BUILDER = /\b(?:indexedKeyRegex|indexedElements)\(/;
const NAMES_TO_INT = /'to_int'/;

/**
 * Reading a `to_int` index with the LANGUAGE's parser.
 *
 * `Number` is the correct reader for an `is_valid_int` capture — the grammar has
 * already vetted it, and `godotLiteralGrammar.guard.test.ts` says so in as many
 * words. Under `to_int` it is the whole defect: the capture is a whole path
 * SEGMENT, so `Number('a-1')` is NaN where the engine's parse is -1, and every
 * comparison against NaN is false, which reads as "in range" at every site that
 * asks. `toIntIndex` (`godot/string.ts`) is the reader, and it is named rather
 * than exempted so the ban can be absolute.
 */
const RAW_INDEX_READ = /\bNumber\(/;

describe('Godot indexed-key grammar', () => {
  const files = allSourceFiles().map((file) => ({
    rel: label(file),
    src: readFileSync(file, 'utf8'),
  }));
  const rules = files.filter(({ src }) => DECLARES_A_RULE.test(src));

  it('finds the rules, so the sweep cannot pass vacuously', () => {
    // Far below the real count: this catches a scrape that BROKE, not a tree
    // that changed.
    expect(rules.length).toBeGreaterThan(100);
  });

  it('spells no index grammar of its own', () => {
    const offenders = rules
      .filter(({ src }) => handRolledIndexGrammar(src) !== null)
      .map(({ rel, src }) => `${rel}: ${handRolledIndexGrammar(src)}`)
      .sort();
    expect(offenders).toEqual([]);
  });

  /**
   * The same ban at the layer where a too-narrow grammar costs a wrong SCENE
   * GRAPH rather than a wrong diagnostic: a `layer_+1/tile_data` the engine
   * applies dropped a whole TileMap layer out of the render tree, and an
   * `item/+7/mesh` dropped a GridMap cell's mesh.
   *
   * Every source module, not a roster of the slices that resolve a key today: a
   * node parser, a resource decoder and a validator all do it, and which files
   * those are changes with every slice.
   */
  it('spells no indexed key grammar of its own, anywhere in the package', () => {
    const offenders = files
      .filter(({ src }) => handRolledKeyGrammar(src) !== null)
      .map(({ rel, src }) => `${rel}: ${handRolledKeyGrammar(src)}`)
      .sort();
    expect(offenders).toEqual([]);
  });

  /**
   * A FENCE, not a regression test: it passes on either side of the sweep above.
   * It states the one thing an empty offender list cannot — that the extractor
   * still extracts, and that the separator is what separates a key grammar from
   * a value one.
   */
  it('the key-grammar extractor recognises a key, and leaves a value grammar alone', () => {
    expect(handRolledKeyGrammar(String.raw`const RE = /^layer_(\d+)\/(.+)$/;`)).not.toBeNull();
    expect(handRolledKeyGrammar(String.raw`const RE = new RegExp('^item/(\\d+)/name$');`)).not
      .toBeNull();
    expect(handRolledKeyGrammar(String.raw`const RE = /^\d+$/;`)).toBeNull();
    expect(handRolledKeyGrammar(String.raw`const RE = /\.(cpp|h|glsl):\d+/;`)).toBeNull();
  });

  /**
   * The segment spelling, at all three of its contracts.
   *
   * The sanctioned line is pinned VERBATIM because it is spared by a
   * tokenization accident, not by intent: {@link REGEX_LITERAL} treats the `/`
   * inside `[^/]` as its own delimiter, so a shape string's leaf capture never
   * reaches a term as one class. An extractor change that repaired that would
   * flag every composed shape in the package, and this is what says so first.
   */
  it('recognises a wildcard index segment, and leaves a generic path helper alone', () => {
    expect(handRolledKeyGrammar(String.raw`const RE = /^settings\/([^/]+)\/joints\/(.+)$/;`))
      .not.toBeNull();
    expect(handRolledKeyGrammar(String.raw`const RE = new RegExp('^item/([^/]+)/name$');`)).not
      .toBeNull();
    // Names no family segment: a first-segment stripper, not an index grammar.
    expect(handRolledKeyGrammar(String.raw`const RE = /^[^/]+\//;`)).toBeNull();
    // The composed spelling this guard wants, exactly as a slice writes it.
    expect(
      handRolledKeyGrammar(
        String.raw`const JOINT_KEY = indexedKeyRegex('^settings/(#)/joints/#/([^/]+)(?:/.*)?$', 'to_int');`
      )
    ).toBeNull();
  });

  it('reads a to_int index through toIntIndex, never Number', () => {
    const population = files
      .map(({ rel, src }) => ({ rel, bare: stripComments(src) }))
      .filter(({ bare }) => COMPOSES_BUILDER.test(bare) && NAMES_TO_INT.test(bare));
    // Anti-vacuity, and the term is builder-derived: a rename that stopped every
    // caller naming the parse would empty this and leave it trivially green.
    expect(population.length).toBeGreaterThan(5);

    const offenders = population
      .filter(({ bare }) => RAW_INDEX_READ.test(bare))
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });

  /**
   * The two grammars, at the one place source text cannot tell them apart: both
   * are built by the same call, and only the argument separates them. A shape
   * that stopped substituting, or a parse that silently fell back to the other,
   * would leave every assertion above green.
   */
  it('admits the spellings each engine parse resolves, and no others', () => {
    const validInt = indexedKeyRegex('^item_(#)/', 'is_valid_int');
    // `is_valid_int` skips ONE leading sign, `+` as readily as `-`
    // (ustring.cpp:4752), then demands digits to the end.
    expect(validInt.test('item_+5/text')).toBe(true);
    expect(validInt.test('item_-5/text')).toBe(true);
    expect(validInt.test('item_05/text')).toBe(true);
    expect(validInt.test('item_x/text')).toBe(false);
    expect(validInt.test('item_1x/text')).toBe(false);
    expect(validInt.test('item_+/text')).toBe(false);

    const toInt = indexedKeyRegex('^settings/(#)/', 'to_int');
    // `to_int` reads whatever the segment holds (ustring.cpp:2303-2311), so the
    // grammar is the segment and the reader decides the number.
    expect(toInt.test('settings/a-1/bone_name')).toBe(true);
    expect(toInt.test('settings/x/bone_name')).toBe(true);
    expect(toInt.exec('settings/a-1/bone_name')?.[1]).toBe('a-1');
    // Still a SEGMENT: the index ends at the first `/`, or `settings/0/joints`
    // would read an index of `0/joints` and match no leaf at all.
    expect(toInt.exec('settings/0/joints/1/bone')?.[1]).toBe('0');
  });
});
