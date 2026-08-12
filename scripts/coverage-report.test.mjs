/**
 * Guards the coverage ledger against the three ways it could quietly lie.
 *
 * The ledger is the resume point for a long node-coverage push — "what is left"
 * is computed, never written down, so it cannot drift the way a checklist does.
 * That only holds while its notion of "registered" matches the catalog's
 * `supported`, and while the catalog is regenerated after the registry changes.
 *
 * The failure this file exists to prevent already happened: `supported` was a
 * `typeName: '…'` scrape of slice sources, and `StaticBody2D`, `RigidBody2D` and
 * `CharacterBody2D` are registered by a loop with no string literal to match. The
 * catalog called three shipped node types "not implemented" for as long as that
 * scrape lived. Both sides now read the same live registry, and this asserts it.
 *
 * The third way is the build: that live registry is the one in `dist/`, so an
 * unbuilt or out-of-date `dist/` makes every assertion here agree about a
 * previous revision. It is checked first, and refused rather than measured.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { collectCoverage } from './coverage-report/collect.mjs';

const CATALOG = join(import.meta.dirname, 'compare-docs/node-catalog.json');
const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));

const CORE = join(import.meta.dirname, '../packages/textscene-core');
const CORE_SRC = join(CORE, 'src');
const BUILD = 'pnpm --filter @textscene/core build';

/**
 * `tsc` emits `src/**` minus the tests, the test kit and the ambient
 * declarations, so an edit to those is not staleness: a guard that fires on
 * work it cannot be measuring is one people learn to bypass. Mirrors the
 * package tsconfig's `exclude`.
 */
const COMPILED = /\.tsx?$/;
const NOT_COMPILED = /\.d\.ts$|\.(test|spec)\.tsx?$/;

/** Newest mtime under `dir` among files `keep` accepts, and which file carries it. */
function newest(dir, keep) {
  let at = 0;
  let file = '';
  const walk = (d) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'testing') walk(p);
        continue;
      }
      if (!keep(e.name)) continue;
      const m = statSync(p).mtimeMs;
      if (m > at) {
        at = m;
        file = p;
      }
    }
  };
  walk(dir);
  return { at, file };
}

/**
 * The ledger is read from the BUILT registries, so an unbuilt or stale `dist/`
 * has this file reporting a previous revision's coverage as fact — and every
 * assertion still passes. Refuse to measure instead; building here would race
 * the build step that owns `dist/`.
 */
function stalenessMessage() {
  const built = newest(join(CORE, 'dist'), (n) => n.endsWith('.js'));
  if (!built.at) return `packages/textscene-core/dist is not built — run \`${BUILD}\`.`;
  const source = newest(CORE_SRC, (n) => COMPILED.test(n) && !NOT_COMPILED.test(n));
  if (source.at > built.at) {
    return (
      `packages/textscene-core/dist predates ${relative(CORE, source.file)} — this ledger would ` +
      `report the PREVIOUS revision's registries. Run \`${BUILD}\`.`
    );
  }
  return null;
}

const stale = stalenessMessage();
const coverage = stale ? null : await collectCoverage();

describe('coverage ledger', () => {
  // Fails every assertion below with one actionable message rather than letting
  // them agree with stale data.
  beforeAll(() => {
    if (stale) throw new Error(stale);
  });

  it('agrees with the catalog on which types are supported', () => {
    const catalogSupported = catalog.nodes
      .filter((n) => n.supported)
      .map((n) => n.name)
      .sort();
    // The ledger's registered set spans every type the parser knows; the catalog
    // can only speak for types Godot's ClassDB listed.
    const catalogued = new Set(catalog.nodes.map((n) => n.name));
    const registeredAndCatalogued = coverage.registered.filter((t) => catalogued.has(t)).sort();

    expect(registeredAndCatalogued).toEqual(catalogSupported);
  });

  it('accounts for every catalogued type as registered or missing', () => {
    const missing = coverage.missing.map((n) => n.name);
    const registeredAndCatalogued = coverage.registered.filter((t) =>
      catalog.nodes.some((n) => n.name === t)
    );
    expect(missing.length + registeredAndCatalogued.length).toBe(coverage.total);
  });

  it('has no registration for a type absent from Godot ClassDB', () => {
    // AreaLight3D is the one sanctioned exception and is filtered upstream — see
    // NOT_IN_CLASSDB. Anything else here is a typo in a `typeName`.
    expect(coverage.phantom).toEqual([]);
  });

  it('reports missing types in dependency order — a base class before its subclasses', () => {
    const position = new Map(coverage.missing.map((n, i) => [n.name, i]));
    const inverted = coverage.missing.flatMap((n) =>
      n.chain
        .filter((ancestor) => position.has(ancestor) && position.get(ancestor) > position.get(n.name))
        .map((ancestor) => `${n.name} scheduled before its ancestor ${ancestor}`)
    );
    expect(inverted).toEqual([]);
  });
});
