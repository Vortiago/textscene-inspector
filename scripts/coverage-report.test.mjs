/**
 * Guards the coverage ledger against the two ways it could quietly lie.
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
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectCoverage } from './coverage-report/collect.mjs';

const CATALOG = join(import.meta.dirname, 'compare-docs/node-catalog.json');
const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));

const coverage = await collectCoverage();

describe('coverage ledger', () => {
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
