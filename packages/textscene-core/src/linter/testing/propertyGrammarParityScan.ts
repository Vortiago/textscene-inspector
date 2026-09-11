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

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { baseChain } from '../../godot/nodeBaseTypes.js';

// Re-exported, not re-derived: two modules in this directory resolving the same
// directory from their own `import.meta.url` is two `..` counts to keep right.
export { nodesRoot } from './ruleNameScrape.js';
import { atLeast, nodesRoot, walk } from './ruleNameScrape.js';

// ---------------------------------------------------------------------------
// Base-type to parser directory mapping.
// Used to walk the inherited parser property chain in parallel with the
// NODE_BASE_TYPES validator chain.
//
// Exported so `propertyGrammarParityScan.test.ts` can hold it COMPLETE: an
// ancestor missing here is skipped in silence, unlike a mapped one whose file
// has moved.
// ---------------------------------------------------------------------------

export const BASE_TYPE_TO_PARSER_SUBPATH: Readonly<Record<string, string>> = {
  Node3D: 'base/node3d/parser.ts',
  Node2D: 'base/node2d/parser.ts',
  Light3D: '3d/lights/shared/parser.ts',
  // Button owns a parser.ts of its own, so a Button subclass that chains through
  // `parseButton` really does read `text`/`flat`/`alignment`/the icon trio.
  // Leaving this hop out made every one of those look linter-only on any such
  // subclass, which reads as a validator desync when the parser is fine.
  Button: '2d/ui/button/parser.ts',
  Control: '2d/ui/control/parser.ts',
  // ParallaxBackground is a CanvasLayer, not a Node2D, so `visible` and `layer`
  // reach it through this parser and nothing else.
  CanvasLayer: '2d/ui/canvaslayer/parser.ts',
  Node: 'node/parser.ts',
  // The container and mesh hops, measured rather than guessed: walking
  // NODE_BASE_TYPES for every base-parser-reusing slice shows a small fixed set
  // of ancestors covers all of them, and the entries above resolve all but these.
  VBoxContainer: '2d/ui/vboxcontainer/parser.ts',
  HBoxContainer: '2d/ui/hboxcontainer/parser.ts',
  PanelContainer: '2d/ui/panelcontainer/parser.ts',
  MeshInstance3D: '3d/meshinstance3d/parser.ts',
  // Two family parsers that live in `shared/` rather than under a type of their
  // own, which is why the subpath is a module and not a slice: a Range subclass
  // reads the five Range keys `parseRange` models, and a Slider subclass its
  // three more through `parseSlider`. Without the hops every one of those reads
  // as linter-only on HSlider and VSlider.
  Range: '2d/ui/shared/range.ts',
  Slider: '2d/ui/shared/slider.ts',
  // Both bases are real scene types with a parser of their own, and each is
  // also the hop their H/V subclasses inherit `vertical` and the family's own
  // keys through.
  BoxContainer: '2d/ui/boxcontainer/parser.ts',
  SplitContainer: '2d/ui/splitcontainer/parser.ts',
  // CodeEdit inherits the whole TextEdit surface, and GraphNode/GraphFrame the
  // whole GraphElement one; without these hops every inherited read looks
  // linter-only on the subclass.
  TextEdit: '2d/ui/textedit/parser.ts',
  GraphElement: '2d/ui/graphelement/parser.ts',
};

/**
 * Every directory holding a `linterParser.ts`, `parser.ts` or not. The subset
 * {@link findSliceDirs} narrows, so the parity guard's blind-spot count has
 * something to measure against.
 *
 * Floored, because every consumer of both walks reports its finding as an EMPTY
 * list: a walk that matched nothing reads exactly like a clean tree.
 */
export function findLinterParserDirs(dir: string): string[] {
  return atLeast(walk(dir, 'linterParser.ts').map(dirname), 150, 'findLinterParserDirs');
}

/** The directories holding both `parser.ts` and `linterParser.ts`. */
export function findSliceDirs(dir: string): string[] {
  const dirs = findLinterParserDirs(dir).filter((d) => existsSync(join(d, 'parser.ts')));
  return atLeast(dirs, 50, 'findSliceDirs');
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
 * Every key a parser FILE reads: its own accesses, plus those of each relative
 * import it hands the whole bag to — `parseAudioBase(properties, ctx)`,
 * `parseBoxContainer(heading, properties)`, `finishCsgParse(result, properties)`
 * — followed recursively. A base parser reached this way is scraped too; the
 * base table walks the chain the type DECLARES, which need not be the one the
 * parser calls.
 */
export function scrapeParserReads(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return new Set();
  seen.add(file);
  const src = readFileSync(file, 'utf8');
  const reads = scrapeParserProps(src);
  const importRe = /import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(src)) !== null) {
    const names = m[1]!.split(',').map((n) => n.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()!);
    const specifier = m[2]!;
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
