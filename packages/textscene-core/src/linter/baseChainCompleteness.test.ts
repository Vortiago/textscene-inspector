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
import { NODE_BASE_TYPES } from './nodeBaseTypes.js';
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
 * `Node` is the terminal itself. The three base types carry validators under
 * their own name and are mapped to `Node` in the table, so they resolve
 * normally — they are listed here only because a chain of length zero is not a
 * chain. Add to this list ONLY for a type with genuinely no ancestor to inherit
 * from, and say why; an entry added to silence a failure re-creates exactly the
 * silent gap this guard exists to close.
 */
const TERMINAL: ReadonlySet<string> = new Set(['Node']);

/** Walk `type` up the table, returning the chain or the point it broke. */
function resolveChain(type: string): { chain: string[]; ok: boolean } {
  const chain: string[] = [type];
  const seen = new Set<string>([type]);
  let current = type;

  while (!TERMINAL.has(current)) {
    const parent: string | undefined = NODE_BASE_TYPES[current];
    if (parent === undefined) return { chain, ok: false };
    if (seen.has(parent)) return { chain: [...chain, `${parent} (cycle)`], ok: false };
    seen.add(parent);
    chain.push(parent);
    current = parent;
  }
  return { chain, ok: true };
}

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

  it('keeps the terminal list minimal — every entry must still be unresolvable', () => {
    // A type that gained a real base should leave TERMINAL rather than linger as
    // a permanent exemption.
    const nowResolvable = [...TERMINAL].filter((type) => NODE_BASE_TYPES[type] !== undefined);
    expect(nowResolvable).toEqual([]);
  });

  /**
   * The table deliberately flattens: a leaf maps to its nearest
   * VALIDATOR-BEARING ancestor, not to its immediate Godot parent, so `HSlider`
   * points at `Control` while Godot says `Slider` (which carries nothing).
   *
   * That shortcut is only safe while the classes it skips stay empty. The day a
   * skipped class gains validators — and this branch exists to add ~148 of them,
   * `Range` among the first — every leaf that jumped over it silently stops
   * inheriting them: `findValidator` walks straight past, returns null, and
   * `StrictTscnParser` accepts the property without a word. Reachability to
   * `Node` still holds, so the assertion above cannot see it.
   *
   * This is the assertion that does. It fails the moment a skipped ancestor
   * starts validating something, naming the leaves that must be re-chained.
   */
  it('skips no ancestor that carries validators of its own', () => {
    const validating = new Set(validatorRegistry.getRegisteredNodeTypes());

    const skipped = registered.flatMap((type) => {
      const parent = NODE_BASE_TYPES[type];
      const chain = CATALOG_CHAINS.get(type);
      if (!parent || !chain) return [];
      const parentAt = chain.indexOf(parent);
      if (parentAt === -1) return []; // not a Godot ancestor at all — see below
      return chain
        .slice(0, parentAt)
        .filter((ancestor) => validating.has(ancestor))
        .map(
          (ancestor) =>
            `${type} is chained to ${parent}, skipping ${ancestor}, which now has its own validators`
        );
    });

    expect(skipped).toEqual([]);
  });

  it('never chains a type to something Godot does not list as its ancestor', () => {
    const wrong = registered
      .filter((type) => {
        const parent = NODE_BASE_TYPES[type];
        const chain = CATALOG_CHAINS.get(type);
        // `Node` is every chain's terminal and the catalog omits types Godot
        // cannot instantiate, so an absent chain proves nothing.
        return parent && parent !== 'Node' && chain && !chain.includes(parent);
      })
      .map((type) => `${type} → ${NODE_BASE_TYPES[type]} is not on its Godot ancestor chain`);

    expect(wrong).toEqual([]);
  });
});
