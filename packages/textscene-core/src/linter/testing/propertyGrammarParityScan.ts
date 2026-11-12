/**
 * Reads the slices off disk: which directories are slices, which parser each registers, and which
 * keys each side names. The parser half is a scrape of `properties.X` and `properties['X']`,
 * since nothing in the build exposes that set. The allowlist records the reads a scrape cannot
 * see, such as a table-driven one.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { classBaseChain } from '../../godot/classdb/classBaseTypes.js';
import * as PROPERTY_LIST_FAMILIES from '../../godot/classdb/propertyListFamilies.js';
import type { IndexedFamily } from '../../godot/classdb/indexedFamily.js';

// Re-exported, not re-derived: two modules in this directory resolving the same
// directory from their own `import.meta.url` is two `..` counts to keep right.
export { nodesRoot } from './ruleNameScrape.js';
import { atLeast, nodesRoot, walk } from './ruleNameScrape.js';
import { BASE_TYPE_TO_PARSER_SUBPATH } from './baseParserSubpaths.js';

/**
 * Every directory holding a `linterParser.ts`, `parser.ts` or not: the set
 * {@link findSliceDirs} narrows, and `UNSWEPT_SLICES` accounts for the rest. Floored, because an
 * empty walk reads like a clean tree to every consumer.
 */
export function findLinterParserDirs(dir: string): string[] {
  return atLeast(walk(dir, 'linterParser.ts').map(dirname), 150, 'findLinterParserDirs');
}

/** The parser files of the base types: a slice that registers one of these reads no key of its own. */
const BASE_PARSER_FILES: ReadonlySet<string> = new Set(
  Object.values(BASE_TYPE_TO_PARSER_SUBPATH).map((subpath) => join(nodesRoot, subpath))
);

/** Written only by {@link findParserFile}: a slice's parser file never changes during a run. */
const parserFiles = new Map<string, string | null>();

/**
 * The file of the parser a slice registers, or null when it registers a base parser. It is the
 * slice's `parser.ts`, or else the module its `index.ts` names in `parser: <name>` and imports from
 * a relative path, such as a family parser that several slices share.
 */
export function findParserFile(dir: string): string | null {
  if (!parserFiles.has(dir)) parserFiles.set(dir, locateParserFile(dir));
  return parserFiles.get(dir)!;
}

function locateParserFile(dir: string): string | null {
  const own = join(dir, 'parser.ts');
  if (existsSync(own)) return own;
  const indexFile = join(dir, 'index.ts');
  if (!existsSync(indexFile)) return null;
  const src = readFileSync(indexFile, 'utf8');
  const name = /\bparser:\s*(\w+)/.exec(src)?.[1];
  if (!name) return null;
  const specifier = relativeImports(src).find((entry) => entry.names.includes(name))?.specifier;
  if (!specifier) return null;
  const file = resolveImport(indexFile, specifier);
  return BASE_PARSER_FILES.has(file) ? null : file;
}

/** The directories holding a `linterParser.ts` and a parser of their own. */
export function findSliceDirs(dir: string): string[] {
  const dirs = findLinterParserDirs(dir).filter((d) => findParserFile(d) !== null);
  return atLeast(dirs, 50, 'findSliceDirs');
}

/**
 * Scrape `properties.X`, `properties['X']` and `properties[FAMILY.countKey.key]` accesses from a
 * parser source, the last through the family `propertyListFamilies.ts` declares.
 */
export function scrapeParserProps(src: string, comparesKeys = false): Set<string> {
  const props = new Set<string>();
  // properties.identifier
  const dotRe = /\bproperties\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = dotRe.exec(src)) !== null) props.add(m[1]!);
  // properties['key'] or properties["key"]
  const bracketRe = /\bproperties\[['"]([^'"]+)['"]\]/g;
  while ((m = bracketRe.exec(src)) !== null) props.add(m[1]!);
  // A slice parser that replays the lines in file order tests each key: `key === 'file_mode'`.
  const keyCompareRe = /\bkey === '([^']+)'/g;
  while (comparesKeys && (m = keyCompareRe.exec(src)) !== null) props.add(m[1]!);
  // An indexed family it reads through `indexedKeyRegex('^option_(#)/…')` is the validator's `option_#/*`.
  const indexedRe = /\bindexedKeyRegex\('\^([a-z_]+)\(#\)\//g;
  while ((m = indexedRe.exec(src)) !== null) props.add(`${m[1]}#/*`);
  const countKeyRe = /\bproperties\[([A-Z][A-Z0-9_]*)\.countKey\.key\]/g;
  while ((m = countKeyRe.exec(src)) !== null) props.add(familyCountKey(m[1]!));
  return props;
}

/** The count key of the family exported as `name`, which a scrape must name or it reads nothing. */
function familyCountKey(name: string): string {
  const family = (PROPERTY_LIST_FAMILIES as Record<string, IndexedFamily | undefined>)[name];
  const key = family?.countKey.key;
  if (!key) throw new Error(`expected a family with a count key in propertyListFamilies.ts, got ${name}`);
  return key;
}

/** Each `import { a, type b, c as d } from './x'` of `src`: the local names and the relative specifier. */
function relativeImports(src: string): { names: string[]; specifier: string }[] {
  const importRe = /import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g;
  return [...src.matchAll(importRe)].map(([, list, specifier]) => ({
    names: list!.split(',').map((n) =>
      n
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .pop()!
    ),
    specifier: specifier!,
  }));
}

/**
 * Every key a parser file reads, following each relative import it hands the
 * whole bag to, such as `parseAudioBase(properties, ctx)`, recursively. The base
 * table walks the chain the type declares, which need not be the one it calls.
 */
export function scrapeParserReads(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return new Set();
  // Only the slice's own parser: a helper it calls compares keys for a family another type validates.
  const isSliceParser = seen.size === 0;
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  const reads = scrapeParserProps(src, isSliceParser);
  for (const { names, specifier } of relativeImports(src)) {
    for (const name of names) {
      if (!name || !new RegExp(`\\b${name}\\((?:[^()]*,\\s*)?properties\\s*[,)]`).test(src)) continue;
      for (const key of scrapeParserReads(resolveImport(file, specifier), seen)) reads.add(key);
    }
  }
  return reads;
}

/** `./x` or `./x.js` beside `from`, as the `.ts` module it names. */
function resolveImport(from: string, specifier: string): string {
  const base = resolve(dirname(from), specifier.replace(/\.js$/, ''));
  const candidate = [`${base}.ts`, join(base, 'index.ts')].find(existsSync);
  if (!candidate) throw new Error(`${specifier}, imported by ${from}, resolves to no file`);
  return candidate;
}

/**
 * All `properties.X` accesses inherited from the base parser files of a node
 * type's NODE_BASE_TYPES chain. Throws if a mapped base parser file has moved,
 * so a broken mapping fails loudly instead of surfacing as bogus asymmetries.
 */
export function getInheritedParserProps(nodeType: string): Set<string> {
  const result = new Set<string>();
  for (const base of classBaseChain(nodeType)) {
    const subpath = BASE_TYPE_TO_PARSER_SUBPATH[base];
    if (!subpath) continue;
    const parserPath = join(nodesRoot, subpath);
    if (!existsSync(parserPath)) {
      throw new Error(`BASE_TYPE_TO_PARSER_SUBPATH['${base}'] points at a missing file: ${subpath}`);
    }
    for (const p of scrapeParserProps(readFileSync(parserPath, 'utf8'))) result.add(p);
  }
  return result;
}

/**
 * The node type a linterParser.ts speaks for, from `registerAll` or
 * `registerUnavailable`, since a removal-only slice registers no validator.
 * Null for a shared helper that registers nothing.
 */
export function extractNodeType(src: string): string | null {
  const m = /register(?:All|Unavailable)\s*\(\s*'([^']+)'/.exec(src);
  return m ? m[1]! : null;
}
