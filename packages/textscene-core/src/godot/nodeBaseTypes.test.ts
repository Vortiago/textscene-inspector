/**
 * The ancestry readers `godot/` exports, against the table itself. The sibling
 * `linter/nodeBaseTypes.test.ts` asks the linter question of registered types. The walks are
 * longhand rather than through `baseChain`: a guard on the table must not read it through a helper.
 */

import { describe, expect, it } from 'vitest';
import {
  MAX_BASE_CHAIN_HOPS,
  NODE_BASE_TYPES,
  UNCATALOGUED_BASE_TYPES,
  baseChain,
  descendsFrom,
  isCatalogedType,
} from './nodeBaseTypes.js';
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
    expect(NODE_BASE_TYPES.AreaLight3D).toBe(UNCATALOGUED_BASE_TYPES.AreaLight3D);
    expect(Object.isFrozen(NODE_BASE_TYPES)).toBe(true);
  });

  it('gives `Node` no entry, since it is the terminal', () => {
    expect(NODE_BASE_TYPES.Node).toBeUndefined();
  });
});

describe('descendsFrom', () => {
  it('walks every hop, not just the declared parent', () => {
    expect(descendsFrom('Sprite2D', 'Node2D')).toBe(true);
    expect(descendsFrom('Sprite2D', 'CanvasItem')).toBe(true);
    expect(descendsFrom('Sprite2D', 'Node')).toBe(true);
  });

  it('counts a type as its own ancestor, the way ClassDB `is_class` does', () => {
    expect(descendsFrom('Node2D', 'Node2D')).toBe(true);
  });

  it('is false for an unrelated ancestor', () => {
    // The name heuristic this replaced claimed the opposite for both.
    expect(descendsFrom('Sprite2D', 'Node3D')).toBe(false);
    expect(descendsFrom('NavigationAgent3D', 'Node3D')).toBe(false);
  });

  it('is false for a class this build never heard of', () => {
    expect(descendsFrom('SomeGDExtensionNode', 'Node')).toBe(false);
  });

  it('reads a prototype-named type as unknown, not as Object.prototype', () => {
    // The type name comes from the `.tscn`. Bare indexing answers `constructor`
    // with a function and `__proto__` with the prototype, either of which puts a
    // non-string into the walk's `string | undefined`.
    expect(descendsFrom('__proto__', 'Node')).toBe(false);
    expect(descendsFrom('constructor', 'Node')).toBe(false);
    expect(descendsFrom('toString', 'Node')).toBe(false);
  });
});

describe('baseChain', () => {
  it('lists every ancestor nearest first, excluding the type itself', () => {
    expect(baseChain('Sprite2D')).toEqual(['Node2D', 'CanvasItem', 'Node']);
  });

  it('is empty for the terminal and for an unknown type', () => {
    expect(baseChain('Node')).toEqual([]);
    expect(baseChain('SomeGDExtensionNode')).toEqual([]);
    expect(baseChain('__proto__')).toEqual([]);
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
    // would be silently truncated instead, which is the failure `descendsFrom`
    // cannot report.
    const deepest = (table: Readonly<Record<string, string>>): number =>
      Math.max(...Object.keys(table).map((type) => depth(table, type)));
    expect(deepest(NODE_BASE_TYPES)).toBeLessThan(MAX_BASE_CHAIN_HOPS);
    expect(deepest(RESOURCE_BASE_TYPES_GENERATED)).toBeLessThan(MAX_BASE_CHAIN_HOPS);
  });
});
