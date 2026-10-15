/**
 * The node table and `isCatalogedType`, against the table itself. The sibling
 * `linter/nodeBaseTypes.test.ts` asks the linter question of registered types.
 */

import { describe, expect, it } from 'vitest';
import { NODE_BASE_TYPES, isCatalogedType } from './nodeBaseTypes.js';

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
