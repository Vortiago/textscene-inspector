/**
 * The ancestry readers `godot/` exports, against the table itself. The sibling
 * `linter/nodeBaseTypes.test.ts` asks the linter question of registered types. The walks are
 * longhand rather than through a helper: a guard on the table must not read it through one.
 */

import { describe, expect, it } from 'vitest';
import { MAX_BASE_CHAIN_HOPS, NODE_BASE_TYPES, isCatalogedType } from './nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from './resourceBaseTypes.generated.js';

/** Hops from `type` to its root, walking the raw table. */
function depth(table: Readonly<Record<string, string>>, type: string): number {
  const seen = new Set<string>([type]);
  let hops = 0;
  let current = table[type];
  while (current !== undefined && !seen.has(current)) {
    seen.add(current);
    hops++;
    current = table[current];
  }
  return hops;
}

describe('NODE_BASE_TYPES', () => {
  it('merges the catalog with the exception list, and freezes the result', () => {
    // The catalog is the engine's answer; UNCATALOGUED holds only what a
    // 4.6.3 ClassDB cannot supply.
    expect(NODE_BASE_TYPES.Sprite2D).toBe('Node2D');
    expect(NODE_BASE_TYPES.AreaLight3D).toBe('Light3D');
    expect(Object.isFrozen(NODE_BASE_TYPES)).toBe(true);
  });

  it('gives `Node` no entry, since it is the terminal', () => {
    expect(NODE_BASE_TYPES.Node).toBeUndefined();
  });
});

describe('isCatalogedType', () => {
  it('separates "known, not a subclass" from "class this build cannot see"', () => {
    expect(isCatalogedType('Sprite2D')).toBe(true);
    // Abstract, instantiable by nothing, and present because it is an ancestor.
    expect(isCatalogedType('CanvasItem')).toBe(true);
    expect(isCatalogedType('SomeGDExtensionNode')).toBe(false);
  });

  it('knows `Node`, which the table gives no entry of its own', () => {
    expect(isCatalogedType('Node')).toBe(true);
  });

  it('does not mistake a prototype member for a catalogued class', () => {
    expect(isCatalogedType('constructor')).toBe(false);
    expect(isCatalogedType('__proto__')).toBe(false);
    expect(isCatalogedType('hasOwnProperty')).toBe(false);
  });
});

describe('MAX_BASE_CHAIN_HOPS', () => {
  it('clears the deepest chain either catalog states, with slack', () => {
    // The bound only stops a malformed table from spinning; a chain reaching it
    // would be silently truncated instead, which is the failure `descendsFromClass`
    // cannot report.
    const deepest = (table: Readonly<Record<string, string>>): number =>
      Math.max(...Object.keys(table).map((type) => depth(table, type)));
    expect(deepest(NODE_BASE_TYPES)).toBeLessThan(MAX_BASE_CHAIN_HOPS);
    expect(deepest(RESOURCE_BASE_TYPES_GENERATED)).toBeLessThan(MAX_BASE_CHAIN_HOPS);
  });
});
