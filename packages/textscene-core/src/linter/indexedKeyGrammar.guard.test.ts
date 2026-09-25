/**
 * One home per index grammar, `indexedKeyRegex`, so a rule never spells Godot's again.
 * Its shape string puts `#` at each index position, so it spells every key shape: a
 * nested index (`settings/#/joints/#/twist_amount`), no leaf (`collisions/#`) and a
 * `:`-joined pair (`(#):(#)/…`). Neither population below has an exemption list.
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
 * A file that declares a phase-2 rule, by the one property a rule cannot be renamed or
 * moved out of: it hands itself to the registry. A `linter.ts` path roster would break
 * when a rule moves into a sibling file as its slice grows.
 */
const DECLARES_A_RULE = /ruleRegistry\.register\(/;

/**
 * A regex literal, and a `new RegExp` string argument, extracted as in
 * `godotLiteralGrammar.guard.test.ts`. Requiring a closing delimiter keeps prose out, and
 * the body class excludes `\n`, so a match never pairs one line's `/` with another's.
 */
const REGEX_LITERAL = /\/(?![/*])((?:[^/\\\n[]|\\.|\[(?:[^\]\\]|\\.)*\])+)\/[dgimsuvy]*/g;
const REGEXP_CTOR = /new RegExp\(\s*(['"`])((?:[^\\]|\\.)*?)\1/g;

/**
 * A digit class, however it is spelled: `\d`, `[0-9]` or `\p{Nd}`. Banning the meaning,
 * not the character sequence, lets this carry no allowlist.
 */
const DIGIT_CLASS = /\\d|\[0-9]|\\p\{Nd\}/;

/**
 * A wildcard segment, `[^/]+`, the index spelling a digit-class ban cannot see: `to_int`
 * refuses nothing, so a family reading its index that way matches the whole segment. Only
 * the negated-slash opening is required, so `[^/\s]` and any other narrowing lands here too.
 */
const SEGMENT_CLASS = /\[\^\\?\//;

/** Character classes removed, so a `/` inside one cannot pass for a separator. */
const withoutClasses = (body: string): string => body.replace(/\[(?:[^\]\\]|\\.)*\]/g, '');

/**
 * A literal path segment (`settings\/`, `joints\/`): a wildcard segment is an index only
 * when the pattern also names its family. `generic6dofjoint3d/linterParser.ts`'s
 * `/^[^/]+\//` names none: it strips a group prefix Godot enumerates, not indexes, and has
 * no `#` to compose.
 */
const LITERAL_SEGMENT = /\w\\?\//;

/**
 * `${…}` blanked. A prefix or a leaf name interpolated into a shape string is an
 * argument to the shared builder, not a grammar, and composing the builder is
 * the pattern this guard wants.
 */
const withoutInterpolations = (src: string): string => src.replace(/\$\{[^}]*\}/g, '');

/**
 * A Godot property path's separator, in either extraction's output. A regex literal holds
 * `/` only as `\/` or inside a class ({@link REGEX_LITERAL}), and a `new RegExp` string
 * holds either, so the character alone finds both.
 */
const PATH_SEPARATOR = /\//;

/**
 * The offending pattern text, or `null` when the file spells no digit class in a regex.
 * Source text, not behaviour: a second copy of a grammar is wrong only where the copies
 * disagree, which no test observes until a fixture hits that family.
 */
function handRolledIndexGrammar(source: string): string | null {
  const src = withoutInterpolations(stripComments(source));
  for (const m of src.matchAll(REGEX_LITERAL)) if (DIGIT_CLASS.test(m[1]!)) return m[0];
  for (const m of src.matchAll(REGEXP_CTOR)) if (DIGIT_CLASS.test(m[2]!)) return m[0];
  return null;
}

/**
 * One extracted pattern body, judged against both index spellings: a digit class beside
 * a separator can only be an index, while a wildcard segment is one only where the
 * pattern also names the family ({@link LITERAL_SEGMENT}).
 */
function spellsAnIndexPosition(body: string): boolean {
  if (DIGIT_CLASS.test(body) && PATH_SEPARATOR.test(body)) return true;
  return SEGMENT_CLASS.test(body) && LITERAL_SEGMENT.test(withoutClasses(body));
}

/**
 * The same offence at the parser and decoder layer, narrowed to a key grammar. A key is
 * `/`-separated (`get_slicec('/', n)`, `split("/", true, 2)`, `rsplit("/", true, 1)`),
 * and no value grammar spells a separator, so one beside {@link DIGIT_CLASS} or
 * {@link SEGMENT_CLASS} is an index position in any file, with no allowlist.
 */
function handRolledKeyGrammar(source: string): string | null {
  const src = withoutInterpolations(stripComments(source));
  // Two edges: a `res://` grammar with a digit class would land here (none does, and
  // the answer is a named path builder), and an index with no `/` (`TileSet`'s `pattern_5`,
  // tile_set.cpp:3995) is unseen, since matching a `_`-glued index would pull in every
  // identifier class.
  for (const m of src.matchAll(REGEX_LITERAL)) if (spellsAnIndexPosition(m[1]!)) return m[0];
  for (const m of src.matchAll(REGEXP_CTOR)) if (spellsAnIndexPosition(m[2]!)) return m[0];
  return null;
}

/**
 * Whoever builds or scans an index grammar, derived from the argument that selects the parse.
 * Two terms, not one call pattern: a shape string holds its own parentheses. A rule building
 * `settings/${i}/…` from a loop has no regex to find: `indexedElements` and `indexedKeys` are
 * the scans such rules use, and only a behaviour test holds them to it.
 */
const COMPOSES_BUILDER = /\b(?:indexedKeyRegex|indexedElements|indexedKeys)\(/;
const NAMES_A_PARSE = /'(?:to_int|is_valid_int)'/;

/**
 * Reading an index with `Number` or `parseInt`, under either parse. Godot stores `to_int()` in an
 * `int` (`property_list_helper.cpp:57`): `Number('4294967296')` is 4294967296 where Godot stores
 * 0, and `Number('a-1')` is NaN where it reads -1. `stringToInt` (`godot/string.ts`) is the reader.
 */
const RAW_INDEX_READ = /\b(?:Number|parseInt)\(/;

/** Whether `source` composes an index grammar and reads a number with `Number` or `parseInt`. */
function readsIndexRaw(source: string): boolean {
  const bare = stripComments(source);
  return COMPOSES_BUILDER.test(bare) && NAMES_A_PARSE.test(bare) && RAW_INDEX_READ.test(bare);
}

describe('Godot indexed-key grammar', () => {
  const files = allSourceFiles().map((file) => ({
    rel: label(file),
    src: readFileSync(file, 'utf8'),
  }));
  const rules = files.filter(({ src }) => DECLARES_A_RULE.test(src));

  it('finds the rules, so the sweep cannot pass vacuously', () => {
    // Far below the real count: this catches a scrape that broke, not a tree
    // that changed.
    expect(rules.length).toBeGreaterThan(100);
  });

  it('spells no index grammar of its own', () => {
    // A rule file may spell no digit class in a regex at all: its value grammars go
    // through `v` and `slotTupleRegex`, so any digit class left is a key grammar.
    const offenders = rules
      .filter(({ src }) => handRolledIndexGrammar(src) !== null)
      .map(({ rel, src }) => `${rel}: ${handRolledIndexGrammar(src)}`)
      .sort();
    expect(offenders).toEqual([]);
  });

  /**
   * The same ban where a too-narrow grammar drops a TileMap layer or a GridMap mesh from
   * the scene graph. A parser or decoder also reads values (`arraymesh/surfaceFields.ts`
   * and `animationtree/treeResources.ts` spell a digit class legitimately), so this bans
   * an index spelling beside a separator only, in every module.
   */
  it('spells no indexed key grammar of its own, anywhere in the package', () => {
    const offenders = files
      .filter(({ src }) => handRolledKeyGrammar(src) !== null)
      .map(({ rel, src }) => `${rel}: ${handRolledKeyGrammar(src)}`)
      .sort();
    expect(offenders).toEqual([]);
  });

  /**
   * A fence, not a regression test: it passes on either side of the sweep above, and
   * states that the extractor still extracts and that the separator tells a key grammar
   * from a value one.
   */
  it('the key-grammar extractor recognises a key, and leaves a value grammar alone', () => {
    expect(handRolledKeyGrammar(String.raw`const RE = /^layer_(\d+)\/(.+)$/;`)).not.toBeNull();
    expect(handRolledKeyGrammar(String.raw`const RE = new RegExp('^item/(\\d+)/name$');`)).not
      .toBeNull();
    expect(handRolledKeyGrammar(String.raw`const RE = /^\d+$/;`)).toBeNull();
    expect(handRolledKeyGrammar(String.raw`const RE = /\.(cpp|h|glsl):\d+/;`)).toBeNull();
  });

  /**
   * The segment spelling, at all three of its contracts. The composed line is pinned
   * verbatim because a tokenisation accident spares it: {@link REGEX_LITERAL} treats the
   * `/` in `[^/]` as its delimiter, so an extractor that repaired that would flag every
   * composed shape, and this says so first.
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

  it('reads an index through stringToInt, never Number or parseInt, under either parse', () => {
    const population = files
      .map(({ rel, src }) => ({ rel, bare: stripComments(src) }))
      .filter(({ bare }) => COMPOSES_BUILDER.test(bare) && NAMES_A_PARSE.test(bare));
    // Anti-vacuity, and the term is builder-derived: a rename that stopped every
    // caller naming the parse would empty this and leave it trivially green.
    expect(population.length).toBeGreaterThan(20);

    const offenders = files
      .filter(({ src }) => readsIndexRaw(src))
      .map(({ rel }) => rel)
      .sort();
    expect(offenders).toEqual([]);
  });

  /**
   * A fence, not a regression test: an `is_valid_int` family reading its capture with `Number`,
   * as ItemList, TabBar and the TileSet validators did, is an offence, and the reader is not.
   */
  it('flags a raw read of an is_valid_int capture, and leaves stringToInt alone', () => {
    const shape = "const ITEM_KEY_RE = indexedKeyRegex('^item_(#)/', 'is_valid_int');\n";
    expect(readsIndexRaw(`${shape}const index = Number(match[1]);`)).toBe(true);
    expect(readsIndexRaw(`${shape}const index = parseInt(match[1], 10);`)).toBe(true);
    expect(readsIndexRaw(`${shape}const index = stringToInt(match[1]!);`)).toBe(false);
    // A comment naming the reader is not a call to it.
    expect(readsIndexRaw(`${shape}// never Number(match[1])\nconst i = stringToInt(t);`)).toBe(
      false
    );
  });

  /**
   * The two grammars, where source text cannot tell them apart: one call builds both.
   * A hand-written `-?\d+` misses the `+` ustring.cpp:4752 admits, and `[+-]?\d+` misses
   * every `to_int` segment. A shape that stopped substituting would leave all above green.
   */
  it('admits the spellings each engine parse resolves, and no others', () => {
    const validInt = indexedKeyRegex('^item_(#)/', 'is_valid_int');
    // `PropertyListHelper` gates on `String::is_valid_int()` (`property_list_helper.cpp:53-55`),
    // which skips one leading sign, `+` as readily as `-` (ustring.cpp:4752), then
    // demands digits to the end.
    expect(validInt.test('item_+5/text')).toBe(true);
    expect(validInt.test('item_-5/text')).toBe(true);
    expect(validInt.test('item_05/text')).toBe(true);
    expect(validInt.test('item_x/text')).toBe(false);
    expect(validInt.test('item_1x/text')).toBe(false);
    expect(validInt.test('item_+/text')).toBe(false);

    const toInt = indexedKeyRegex('^settings/(#)/', 'to_int');
    // A hand-built list reads `get_slicec('/', n).to_int()` ungated (`bone_twist_disperser_3d.cpp:37`,
    // `spring_bone_simulator_3d.cpp:42`, `mesh_instance_3d.cpp:113`). `to_int` skips what it
    // cannot use and flips the sign on a `-` while the total is 0 (ustring.cpp:2303-2311),
    // so the grammar is the segment and the reader decides the number.
    expect(toInt.test('settings/a-1/bone_name')).toBe(true);
    expect(toInt.test('settings/x/bone_name')).toBe(true);
    expect(toInt.exec('settings/a-1/bone_name')?.[1]).toBe('a-1');
    // Still a segment: the index ends at the first `/`, or `settings/0/joints`
    // would read an index of `0/joints` and match no leaf at all.
    expect(toInt.exec('settings/0/joints/1/bone')?.[1]).toBe('0');
  });
});
