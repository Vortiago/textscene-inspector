/**
 * Reads the slices off disk: which directories are slices, and which keys each
 * side names. The parser half is a scrape of `properties.X` and `properties['X']`,
 * since nothing in the build exposes that set. The allowlist records the reads a
 * scrape cannot see, such as a table-driven one.
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { baseChain } from '../../godot/nodeBaseTypes.js';

// Re-exported, not re-derived: two modules in this directory resolving the same
// directory from their own `import.meta.url` is two `..` counts to keep right.
export { nodesRoot } from './ruleNameScrape.js';
import { atLeast, nodesRoot, walk } from './ruleNameScrape.js';

/**
 * Base type to parser file, walked beside the NODE_BASE_TYPES validator chain.
 * Exported so `propertyGrammarParityScan.test.ts` can hold it complete: a
 * missing ancestor is skipped in silence.
 */
export const BASE_TYPE_TO_PARSER_SUBPATH: Readonly<Record<string, string>> = {
  Node3D: 'base/node3d/parser.ts',
  Node2D: 'base/node2d/parser.ts',
  Light3D: '3d/lights/shared/parser.ts',
  // A Button subclass that chains through `parseButton` reads `text`, `flat`,
  // `alignment` and the icon trio. Without this hop each looks linter-only.
  Button: '2d/ui/button/parser.ts',
  Control: '2d/ui/control/parser.ts',
  // ParallaxBackground is a CanvasLayer, not a Node2D, so `visible` and `layer`
  // reach it through this parser and nothing else.
  CanvasLayer: '2d/ui/canvaslayer/parser.ts',
  Node: 'node/parser.ts',
  // The container and mesh hops, measured by walking NODE_BASE_TYPES for every
  // slice that reuses a base parser.
  VBoxContainer: '2d/ui/vboxcontainer/parser.ts',
  HBoxContainer: '2d/ui/hboxcontainer/parser.ts',
  PanelContainer: '2d/ui/panelcontainer/parser.ts',
  MeshInstance3D: '3d/meshinstance3d/parser.ts',
  // Two family parsers in `shared/`, so the subpath is a module, not a slice. A
  // Range subclass reads the keys `parseRange` models, and a Slider subclass
  // more through `parseSlider`.
  Range: '2d/ui/shared/range.ts',
  Slider: '2d/ui/shared/slider.ts',
  // Both bases are real scene types with a parser of their own, and each is
  // also the hop their H/V subclasses inherit `vertical` and the family's own
  // keys through.
  BoxContainer: '2d/ui/boxcontainer/parser.ts',
  SplitContainer: '2d/ui/splitcontainer/parser.ts',
  // CodeEdit inherits the whole TextEdit surface, and GraphNode and GraphFrame
  // the whole GraphElement one.
  TextEdit: '2d/ui/textedit/parser.ts',
  GraphElement: '2d/ui/graphelement/parser.ts',
};

/**
 * Every directory holding a `linterParser.ts`, `parser.ts` or not: the set
 * {@link findSliceDirs} narrows, for the blind-spot count. Floored, because an
 * empty walk reads like a clean tree to every consumer.
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
 * Every key a parser file reads, following each relative import it hands the
 * whole bag to, such as `parseAudioBase(properties, ctx)`, recursively. The base
 * table walks the chain the type declares, which need not be the one it calls.
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
 * The node type a linterParser.ts speaks for, from `registerAll` or
 * `registerUnavailable`, since a removal-only slice registers no validator.
 * Null for a shared helper that registers nothing.
 */
export function extractNodeType(src: string): string | null {
  const m = /register(?:All|Unavailable)\s*\(\s*'([^']+)'/.exec(src);
  return m ? m[1]! : null;
}
