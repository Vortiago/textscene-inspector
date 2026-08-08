/**
 * Reading the slices off disk: which directories are slices, and which property
 * keys each side of one names.
 *
 * The parser half of the parity guard is a SCRAPE, not a parse — `properties.X`
 * and `properties['X']` accesses in the source text — because a parser reads its
 * property bag with plain member access and nothing in the build exposes that
 * set. The consequences of scraping (a table-driven read is invisible) are what
 * the allowlist's shared-helper entries record.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseChain } from '../nodeBaseTypes.js';

const here = dirname(fileURLToPath(import.meta.url));
export const nodesRoot = resolve(here, '../../nodes');

// ---------------------------------------------------------------------------
// Base-type to parser directory mapping.
// Used to walk the inherited parser property chain in parallel with the
// NODE_BASE_TYPES validator chain.
// ---------------------------------------------------------------------------

const BASE_TYPE_TO_PARSER_SUBPATH: Readonly<Record<string, string>> = {
  Node3D: 'base/node3d/parser.ts',
  Node2D: 'base/node2d/parser.ts',
  Light3D: '3d/lights/shared/parser.ts',
  // Button owns a parser.ts of its own, so a Button subclass that chains through
  // `parseButton` really does read `text`/`flat`/`alignment`/the icon trio.
  // Leaving this hop out made every one of those look linter-only on any such
  // subclass, which reads as a validator desync when the parser is fine.
  Button: '2d/ui/button/parser.ts',
  Control: '2d/ui/control/parser.ts',
  Node: 'node/parser.ts',
  // The last four hops, measured rather than guessed: walking NODE_BASE_TYPES for
  // every base-parser-reusing slice shows just NINE distinct ancestors cover all
  // of them, and the six above already resolve all but these.
  VBoxContainer: '2d/ui/vboxcontainer/parser.ts',
  HBoxContainer: '2d/ui/hboxcontainer/parser.ts',
  PanelContainer: '2d/ui/panelcontainer/parser.ts',
  MeshInstance3D: '3d/meshinstance3d/parser.ts',
};

/**
 * Walk dir recursively; collect every path holding a `linterParser.ts`,
 * `parser.ts` or not. The superset {@link findSliceDirs} narrows, so the
 * blind-spot count at the bottom of this file has something to measure against.
 */
export function findLinterParserDirs(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const result = entries.some((e) => e.name === 'linterParser.ts') ? [dir] : [];
  for (const e of entries) {
    if (e.isDirectory()) result.push(...findLinterParserDirs(join(dir, e.name)));
  }
  return result;
}

/** Walk dir recursively; collect paths where both parser.ts and linterParser.ts exist. */
export function findSliceDirs(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const names = new Set(entries.map((e) => e.name));
  const result = names.has('parser.ts') && names.has('linterParser.ts') ? [dir] : [];
  for (const e of entries) {
    if (e.isDirectory()) result.push(...findSliceDirs(join(dir, e.name)));
  }
  return result;
}

/**
 * Scrape `properties.X` and `properties['X']` accesses from a parser source.
 * Returns only identifier-shaped keys (alphanumeric + underscore).
 */
export function scrapeParserProps(src: string): Set<string> {
  const props = new Set<string>();
  // properties.identifier
  const dotRe = /\bproperties\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = dotRe.exec(src)) !== null) props.add(m[1]!);
  // properties['key'] or properties["key"]
  const bracketRe = /\bproperties\[['"]([^'"]+)['"]\]/g;
  while ((m = bracketRe.exec(src)) !== null) props.add(m[1]!);
  return props;
}

/**
 * All `properties.X` accesses inherited from the base parser files of a node
 * type's NODE_BASE_TYPES chain. Throws if a mapped base parser file has moved,
 * so a broken mapping fails loudly instead of surfacing as bogus asymmetries.
 */
export function getInheritedParserProps(nodeType: string): Set<string> {
  const result = new Set<string>();
  for (const base of baseChain(nodeType)) {
    const subpath = BASE_TYPE_TO_PARSER_SUBPATH[base];
    if (!subpath) continue;
    const parserPath = join(nodesRoot, subpath);
    if (!existsSync(parserPath)) {
      throw new Error(
        `BASE_TYPE_TO_PARSER_SUBPATH['${base}'] points at a missing file: ${subpath}`
      );
    }
    for (const p of scrapeParserProps(readFileSync(parserPath, 'utf8'))) result.add(p);
  }
  return result;
}

/**
 * Extract the node type name from a linterParser.ts source via
 * `registerAll('TypeName', ...)`.  Returns null for shared helpers that
 * export constants but do not call registerAll.
 */
/**
 * The node type a linterParser.ts speaks for.
 *
 * Both spellings count. A slice that only REMOVES inherited keys
 * (`registerUnavailable`, the fixed-orientation containers) registers no
 * validator at all, and scraping `registerAll` alone dropped it silently out of
 * this whole inventory — taking its base's allowlist entry down with it.
 */
export function extractNodeType(src: string): string | null {
  const m = /register(?:All|Unavailable)\s*\(\s*'([^']+)'/.exec(src);
  return m ? m[1]! : null;
}
