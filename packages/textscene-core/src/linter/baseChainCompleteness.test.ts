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
import { nodeRegistry } from '../core/NodeRegistry.js';
import { NODE_BASE_TYPES } from './nodeBaseTypes.js';
import '../parser/TscnParser.js'; // side-effect: every slice registers its parser
import './index.js'; // side-effect: every slice registers its validators

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
});
