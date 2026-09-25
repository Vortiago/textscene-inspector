/**
 * The coverage ledger's "registered" must match the catalog's `supported`, the
 * catalog must be regenerated after the registry changes, and `dist/` must be
 * fresh. Both sides read the same live registry, since a source scrape misses
 * types a loop registers.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectCoverage } from './coverage-report/collect.mjs';
import { requireFreshDist } from './distFreshness.mjs';

const CATALOG = join(import.meta.dirname, 'compare-docs/node-catalog.json');
const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));

const CORE = join(import.meta.dirname, '../packages/textscene-core');

// Computed in `beforeAll`, not at module scope, where a throw during a
// concurrent `tsc --build` surfaces as a collection error instead of the message.
let coverage;

describe('coverage ledger', () => {
  // One actionable message on a stale `dist/`, not assertions that agree with it.
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
    // AreaLight3D is filtered upstream (NOT_IN_CLASSDB). Anything else here is a
    // typo in a `typeName`.
    expect(coverage.phantom).toEqual([]);
  });
});
