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
import { buildResourceLedger, collectResourceCoverage } from './coverage-report/resources.mjs';
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

describe('resource coverage ledger', () => {
  const OWN_KEYS = { Material: ['render_priority'] };
  const ledger = (overrides = {}) =>
    buildResourceLedger({
      properties: {
        Resource: [{ name: 'resource_name' }],
        Material: [{ name: 'render_priority' }, { name: 'next_pass' }],
        Gradient: [{ name: 'colors' }, { name: 'offsets' }],
      },
      bases: { Material: 'Resource', Gradient: 'Resource', Noise: 'Resource' },
      claimed: new Set(['Material', 'GLB']),
      ownKeysOf: (name) => OWN_KEYS[name] ?? [],
      ...overrides,
    });
  const row = (name, data = ledger()) => data.classes.find((c) => c.name === name);

  it('counts a claimed class by its validated and unvalidated properties', () => {
    expect(row('Material')).toMatchObject({
      base: 'Resource',
      claimed: true,
      ownProperties: 2,
      validatedProperties: 1,
      unvalidatedProperties: 1,
    });
  });

  it('counts an unclaimed class with no validator as all unvalidated', () => {
    expect(row('Gradient')).toMatchObject({ claimed: false, ownKeys: 0, unvalidatedProperties: 2 });
  });

  it('reports a class with no own properties, such as Noise, as zero rather than leaving it out', () => {
    expect(row('Noise')).toMatchObject({ ownProperties: 0, unvalidatedProperties: 0 });
  });

  it('leaves a claimed pseudo-type outside ClassDB out of every total', () => {
    const data = ledger();
    expect(row('GLB', data)).toBeUndefined();
    expect(data).toMatchObject({ total: 4, claimed: 1, withOwnValidator: 1 });
  });

  it('matches an indexed validator key against its family of properties', () => {
    const data = ledger({
      properties: { Gradient: [{ name: 'stop_0/color' }, { name: 'stop_1/color' }] },
      ownKeysOf: () => ['stop_#/*'],
    });
    expect(row('Gradient', data).validatedProperties).toBe(2);
  });

  it('lists the class with the most unvalidated properties first', () => {
    expect(ledger().classes.map((c) => c.name)).toEqual(['Gradient', 'Material', 'Resource', 'Noise']);
  });
});

describe('resource coverage ledger against the live registries', () => {
  let live;
  beforeAll(async () => {
    requireFreshDist(CORE, 'this ledger');
    live = await collectResourceCoverage();
  }, 60_000);

  it('reports a class with no validator beside one with validators', () => {
    const ownKeysOf = (name) => live.classes.find((c) => c.name === name)?.ownKeys;
    expect(ownKeysOf('BoxMesh')).toBe(0);
    expect(ownKeysOf('BaseMaterial3D')).toBeGreaterThan(0);
  });

  it('counts a class a slice claims', () => {
    expect(live.classes.find((c) => c.name === 'StandardMaterial3D')?.claimed).toBe(true);
    expect(live.claimed).toBeGreaterThan(40);
  });
});
