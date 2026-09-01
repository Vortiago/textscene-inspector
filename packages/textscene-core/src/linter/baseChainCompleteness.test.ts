/**
 * Every registered node type must reach the terminal `Node` through
 * `NODE_BASE_TYPES`.
 *
 * `findValidator` walks that table to deliver the Node3D / Node2D / Control /
 * Light3D base validator sets to subclasses. A type missing from it terminates
 * the walk immediately: `findValidator` returns null, `StrictTscnParser` does
 * `if (!validator) return;`, and the type escapes **every** inherited check
 * while its siblings are validated normally. Nothing fails, nothing warns — the
 * linter simply goes quiet on that node, which is the worst possible shape for a
 * bug in a linter.
 *
 * `baseInheritance.test.ts` witnesses that inheritance works, using a handful of
 * named types. It cannot notice a type nobody thought to add. This does: it is
 * driven by the registry, so a new slice is covered the moment it registers.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nodeRegistry } from '../core/NodeRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { NODE_BASE_TYPES, UNCATALOGUED_BASE_TYPES } from '../godot/nodeBaseTypes.js';
import { CLASS_BASE_TYPES } from '../godot/classBaseTypes.js';
import '../parser/TscnParser.js'; // side-effect: every slice registers its parser
import './index.js'; // side-effect: every slice registers its validators

/**
 * Godot's real class hierarchy, from the committed catalog. This is the
 * generated artifact, not the engine checkout — nothing here reads a Godot
 * source tree (see scripts/godot-source-decoupling.test.mjs).
 */
const CATALOG_CHAINS: ReadonlyMap<string, readonly string[]> = new Map(
  (
    JSON.parse(
      readFileSync(join(import.meta.dirname, '../../../../scripts/compare-docs/node-catalog.json'), 'utf8')
    ) as { nodes: { name: string; chain: string[] }[] }
  ).nodes.map((n) => [n.name, n.chain])
);

/**
 * Types that legitimately terminate the walk on their own.
 *
 * `Node` is the terminal itself, and every other chain reaches it. Add to this
 * list ONLY for a type with genuinely no ancestor to inherit from, and say why;
 * an entry added to silence a failure re-creates exactly the silent gap this
 * guard exists to close.
 */
const TERMINAL: ReadonlySet<string> = new Set(['Node']);

/** Walk `type` up a table, returning the chain or the point it broke. */
function resolveIn(
  table: Readonly<Record<string, string>>,
  terminal: ReadonlySet<string>,
  type: string
): { chain: string[]; ok: boolean } {
  const chain: string[] = [type];
  const seen = new Set<string>([type]);
  let current = type;

  while (!terminal.has(current)) {
    const parent: string | undefined = table[current];
    if (parent === undefined) return { chain, ok: false };
    if (seen.has(parent)) return { chain: [...chain, `${parent} (cycle)`], ok: false };
    seen.add(parent);
    chain.push(parent);
    current = parent;
  }
  return { chain, ok: true };
}

const resolveChain = (type: string) => resolveIn(NODE_BASE_TYPES, TERMINAL, type);

/**
 * The table the registry is actually BUILT with, and its terminals.
 *
 * A `.tscn` names types from both of Godot's hierarchies and `findValidator`
 * resolves them through `CLASS_BASE_TYPES`, so a sweep over the node table
 * alone leaves every Resource class outside the guard: 34 types register
 * validators without appearing in `nodeRegistry`, and the resource tiers among
 * them carry hundreds of inherited key registrations that ride entirely on
 * `RESOURCE_BASE_TYPES_GENERATED` hops. Drop one of those hops and the silence
 * this file exists to prevent — "nothing fails, nothing warns" — returns for
 * every leaf under it.
 */
const CLASS_TERMINAL: ReadonlySet<string> = new Set(['Node', 'Resource']);

describe('NODE_BASE_TYPES covers every registered node type', () => {
  const registered = nodeRegistry.getAllTypeNames();

  it('has registrations to check, so an empty registry cannot pass this', () => {
    expect(registered.length).toBeGreaterThan(80);
  });

  it('resolves every registered type to Node', () => {
    const broken = registered
      .map((type) => ({ type, ...resolveChain(type) }))
      .filter((r) => !r.ok)
      .map((r) => `${r.type}: chain stops at ${r.chain[r.chain.length - 1]}`);

    expect(broken).toEqual([]);
  });

  it('lists no type in NODE_BASE_TYPES that is not itself resolvable', () => {
    const broken = Object.keys(NODE_BASE_TYPES)
      .filter((type) => !resolveChain(type).ok)
      .map((type) => `${type} is a table entry but does not reach Node`);

    expect(broken).toEqual([]);
  });

  it('resolves every VALIDATOR-registered type through the merged table', () => {
    // `validatorRegistry`, not `nodeRegistry`: the registry resolves with
    // `CLASS_BASE_TYPES`, so this is the population and the table that actually
    // decide whether a registered key is reachable.
    const validatorTypes = validatorRegistry.getRegisteredNodeTypes();
    expect(validatorTypes.length).toBeGreaterThan(registered.length);

    const broken = validatorTypes
      .map((type) => ({ type, ...resolveIn(CLASS_BASE_TYPES, CLASS_TERMINAL, type) }))
      .filter((r) => !r.ok)
      .map((r) => `${r.type}: chain stops at ${r.chain[r.chain.length - 1]}`);

    expect(broken).toEqual([]);
  });

  it('keeps the terminal list minimal — every entry must still be unresolvable', () => {
    // A type that gained a real base should leave TERMINAL rather than linger as
    // a permanent exemption.
    const nowResolvable = [...TERMINAL].filter((type) => NODE_BASE_TYPES[type] !== undefined);
    expect(nowResolvable).toEqual([]);
  });

  /**
   * The table is Godot's ancestry verbatim, so "is this the right parent?" is
   * answered by the generator and needs no assertion here. What the generator
   * cannot answer is whether a *registered* type is in the catalog at all: a
   * slice that registers `Sprite2d`, or a type only Godot 4.7 knows, gets no
   * entry, no inherited validators, and — because the walk stops instantly —
   * not a single diagnostic. That is the same silence the reachability check
   * above catches for a broken chain, arriving through a different door.
   */
  it('registers no type the catalog and the exception list both fail to name', () => {
    const unknown = registered
      .filter((type) => type !== 'Node')
      .filter((type) => !CATALOG_CHAINS.has(type) && UNCATALOGUED_BASE_TYPES[type] === undefined)
      .map(
        (type) =>
          `${type} is registered but is neither in node-catalog.json nor in UNCATALOGUED — a typo, or a type newer than the catalog's Godot`
      );

    expect(unknown).toEqual([]);
  });

  it('keeps the exception list to types the catalog genuinely lacks', () => {
    // An entry for a catalogued type would silently override the engine's own
    // answer, which is the hand-maintenance this table exists to end.
    const shadowing = Object.keys(UNCATALOGUED_BASE_TYPES)
      .filter((type) => CATALOG_CHAINS.has(type))
      .map((type) => `${type} is in UNCATALOGUED but the catalog knows its ancestry`);

    expect(shadowing).toEqual([]);
  });

  it('delivers a validator registered on an abstract intermediate to its leaves', () => {
    // The payoff, witnessed rather than asserted structurally: `CanvasItem` and
    // `Viewport` are not instantiable and appear in no scene, so they exist in
    // the table only because they are somebody's ancestor.
    for (const [ancestor, leaf, key] of [
      ['CanvasItem', 'Sprite2D', 'texture_filter'],
      ['CanvasItem', 'Label', 'texture_filter'],
      ['Viewport', 'SubViewport', 'own_world_3d'],
    ] as const) {
      expect(validatorRegistry.getOwnKeys(ancestor)).toContain(key);
      expect(validatorRegistry.findValidator(leaf, key)).not.toBeNull();
    }
  });
});
