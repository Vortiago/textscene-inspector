/**
 * Every node slice is wired into `parser/TscnParser.ts`, the one production import of a slice's
 * `index.ts`. Without it the node falls back to `Node`, logs `Unsupported node type` and keeps its type,
 * so the tree looks right while the slice's parser never runs. Only a test that imports nothing but the
 * barrel catches this: a slice's own test imports its `index.ts`, so the type registers either way.
 */

import { describe, it, expect, vi } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nodeRegistry } from '../core/NodeRegistry.js';
import * as logger from '../logger.js';
// The ONLY registration import in this file. Adding a slice import here would
// register it behind the barrel's back and make every assertion below vacuous.
import { TscnParser } from './TscnParser.js';

const here = dirname(fileURLToPath(import.meta.url)); // .../src/parser
const srcRoot = resolve(here, '..'); // .../src
const nodesRoot = resolve(srcRoot, 'nodes');
const barrelPath = resolve(here, 'TscnParser.ts');

/**
 * Barrel specifiers for a slice `index.ts` that must not ship in the parser bundle.
 * Empty: every node slice registers a parser that belongs in the lenient tree. Add an
 * entry, with its reason, only when that stops being true.
 */
const ALLOWLIST: string[] = [];

/** Every `index.ts` under `nodes/` that registers a node type. */
function findParserEntryPoints(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findParserEntryPoints(full));
    else if (entry.name === 'index.ts' && readFileSync(full, 'utf8').includes('nodeRegistry.register'))
      out.push(full);
  }
  return out;
}

/** The barrel specifier a slice's `index.ts` must be imported as. */
function expectedSpecifier(entryPoint: string): string {
  const rel = relative(srcRoot, entryPoint).split('\\').join('/');
  return `../${rel.replace(/\.ts$/, '.js')}`;
}

function requiredSpecifiers(): string[] {
  return findParserEntryPoints(nodesRoot).map(expectedSpecifier);
}

/** All relative specifiers in the barrel (side-effect imports and `import … from`). */
function barrelRelativeSpecifiers(): string[] {
  const src = readFileSync(barrelPath, 'utf8');
  const re = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:[^;'"]*?\sfrom\s*)?['"]([^'"]+)['"]/g;
  const specs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[1]!.startsWith('.')) specs.push(m[1]!);
  }
  return specs;
}

/** Resolve a relative `.js` (NodeNext) specifier to an on-disk source file. */
function resolveSpecifier(spec: string): string | null {
  const base = resolve(here, spec);
  const candidates: string[] = [];
  if (base.endsWith('.js')) {
    const stem = base.slice(0, -3);
    candidates.push(stem + '.ts', stem + '.tsx');
  } else if (extname(base)) {
    candidates.push(base);
  } else {
    candidates.push(base + '.ts', base + '.tsx', resolve(base, 'index.ts'));
  }
  return candidates.find((c) => existsSync(c)) ?? null;
}

/**
 * The node types one entry point registers, read from disk, since `nodeRegistry`
 * shrinks with the barrel. Two shapes: `typeName: 'Foo'`, and the shorthand `typeName,`
 * of `nodes/physics/2d/index.ts`, which loops over an `as const` array.
 */
function registeredTypeNames(entryPoint: string): string[] {
  const src = readFileSync(entryPoint, 'utf8');
  const named = [...src.matchAll(/\btypeName:\s*'([A-Za-z0-9_]+)'/g)].map((m) => m[1]!);
  if (named.length > 0) return named;
  if (!/\btypeName,/.test(src)) return [];
  const array = /=\s*\[([^\]]*)\]\s*as const/.exec(src);
  return array ? [...array[1]!.matchAll(/'([A-Za-z0-9_]+)'/g)].map((m) => m[1]!) : [];
}

/** A scene whose root is `Node` and whose every child is one registered type. */
function sceneOfEveryType(types: string[]): string {
  const children = types.map((type, i) => `[node name="N${i}" type="${type}" parent="."]`);
  return ['[gd_scene format=3]', '', '[node name="Root" type="Node"]', '', ...children].join('\n');
}

/** Every type name any slice registers, deduped, in walk order. */
function typeNamesOnDisk(): string[] {
  return [...new Set(findParserEntryPoints(nodesRoot).flatMap(registeredTypeNames))];
}

/** Parse `content` and return the `Unsupported node type` warnings it logged. */
function fallbackWarnings(content: string): string[] {
  const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  try {
    new TscnParser().parse(content);
    return warnSpy.mock.calls
      .map((call) => String(call[0]))
      .filter((message) => message.includes('Unsupported node type'));
  } finally {
    warnSpy.mockRestore();
  }
}

// The static half names the missing slice. The runtime half parses every registered
// type through `TscnParser` and pins the count against the files on disk, so the sweep
// cannot shrink with the barrel. A missing barrel line also hides the type from every
// registry-driven sweep (`ownValidatorCoverage`, `baseChainCompleteness`).
describe('parser barrel completeness', () => {
  it('finds the slice parser entry points (sanity: the walk is not empty)', () => {
    // Near the real count, not at 1: `missing` below is computed over this
    // population, so a walk that respells or relocates `index.ts` and matches a
    // handful reports [] over every slice it stopped seeing. 239 today.
    expect(findParserEntryPoints(nodesRoot).length).toBeGreaterThan(200);
    expect(requiredSpecifiers().length).toBeGreaterThan(200);
  });

  it('parser/TscnParser.ts imports every slice that registers a node type', () => {
    const imported = new Set(barrelRelativeSpecifiers());
    const missing = requiredSpecifiers().filter(
      (spec) => !imported.has(spec) && !ALLOWLIST.includes(spec)
    );
    expect(missing).toEqual([]);
  });

  it('every relative import in parser/TscnParser.ts resolves to an existing file', () => {
    const stale = barrelRelativeSpecifiers().filter((spec) => resolveSpecifier(spec) === null);
    expect(stale).toEqual([]);
  });

  it('the allowlist itself stays honest (no entries that are imported anyway or gone)', () => {
    const imported = new Set(barrelRelativeSpecifiers());
    for (const spec of ALLOWLIST) {
      expect(imported.has(spec)).toBe(false); // imported → drop from allowlist
      expect(resolveSpecifier(spec)).not.toBeNull(); // deleted → drop from allowlist
    }
  });

  it('reads a type name out of every entry point (sanity: the scrape still fits the source)', () => {
    // The runtime sweeps below are driven by this list, so a scrape that stops
    // matching reports [] over the types it can no longer see.
    const blind = findParserEntryPoints(nodesRoot).filter(
      (file) => registeredTypeNames(file).length === 0
    );
    expect(blind).toEqual([]);
    expect(typeNamesOnDisk().length).toBeGreaterThan(200);
  });

  it('the barrel alone registers every type name a slice declares', () => {
    // Independent of the specifier comparison above: this one fails on an
    // import that is present but no longer reaches the registration.
    const unregistered = typeNamesOnDisk().filter(
      (type) => nodeRegistry.getRegistration(type) === null
    );
    expect(unregistered).toEqual([]);
  });

  it('lands every declared type in the lenient tree, with no fallback warning', () => {
    const types = typeNamesOnDisk();
    expect(fallbackWarnings(sceneOfEveryType(types))).toEqual([]);
    const parsed = new TscnParser().parse(sceneOfEveryType(types));
    expect(parsed.nodes[0]?.children.map((child) => child.type)).toEqual(types);
  });

  it('still reports a fallback for a type nothing registers (the detector is live)', () => {
    // Without this the sweep above passes when the warning text, the spy or the
    // fallback branch breaks: `[]` is its own success value.
    expect(fallbackWarnings(sceneOfEveryType(['NotARegisteredGodotType']))).toHaveLength(1);
  });
});
