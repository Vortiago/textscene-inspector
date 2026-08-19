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
 * `pnpm validate` builds before it tests, so that precheck never fires in CI —
 * it guards the local workflow alone, and its own cases live beside the module
 * it belongs to, in `distFreshness.test.mjs`.
 *
 * Nothing here asserts the wave ORDER `coverage-report/waveOrder.mjs` computes:
 * every catalogued type is registered (240/240), so `missing` is empty and a
 * base-before-subclass sweep over it iterates nothing. The ordering is correct
 * and the report still prints its section — it simply has no subject to be
 * asserted against while the ledger is complete.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectCoverage } from './coverage-report/collect.mjs';
import { requireFreshDist } from './distFreshness.mjs';

const CATALOG = join(import.meta.dirname, 'compare-docs/node-catalog.json');
const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));

const CORE = join(import.meta.dirname, '../packages/textscene-core');

// Both computed in `beforeAll`, never at module scope: the walk reads a tree a
// concurrent `tsc --build` may be writing, and a throw during module evaluation
// surfaces as a vitest collection error instead of the actionable message.
let coverage;

describe('coverage ledger', () => {
  // Fails every assertion below with one actionable message rather than letting
  // them agree with stale data.
  beforeAll(async () => {
    requireFreshDist(CORE, 'this ledger');
    coverage = await collectCoverage();
  }, 60_000);

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
});
