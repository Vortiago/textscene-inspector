/**
 * The merged ancestry table. A spread keeps the last of a colliding pair and a filtered capture drops
 * a hop, both in silence, and either stops a property being validated, so each is pinned here.
 */

import { describe, expect, it } from 'vitest';
import {
  CLASS_BASE_TYPES,
  MAX_BASE_CHAIN_HOPS,
  classBaseChain,
  descendsFromClass,
  classInheritanceChain,
  findInClassChain,
} from './classBaseTypes.js';
import { NODE_BASE_TYPES } from './nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from './resourceBaseTypes.generated.js';

/**
 * Hops from `type` to its root, walking the raw table longhand: a guard on the table must not read it
 * through the walk it guards.
 */
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

describe('CLASS_BASE_TYPES', () => {
  it('merges two disjoint hierarchies, so nothing is overwritten', () => {
    const shared = Object.keys(NODE_BASE_TYPES).filter((name) => name in RESOURCE_BASE_TYPES_GENERATED);
    expect(shared).toEqual([]);
    expect(Object.keys(CLASS_BASE_TYPES)).toHaveLength(
      Object.keys(NODE_BASE_TYPES).length + Object.keys(RESOURCE_BASE_TYPES_GENERATED).length
    );
  });

  it('carries the classes a filtered capture would have dropped', () => {
    // StandardMaterial3D declares nothing of its own, so it is absent from
    // `resource-properties.json`; BaseMaterial3D declares the lot and is
    // abstract. Either filter loses the chain between the type a scene writes
    // and the type the validators live on.
    expect(CLASS_BASE_TYPES.StandardMaterial3D).toBe('BaseMaterial3D');
    expect(CLASS_BASE_TYPES.BaseMaterial3D).toBe('Material');
    expect(CLASS_BASE_TYPES.Material).toBe('Resource');
  });

  it('keeps Resource as the terminal, as Node is on the other side', () => {
    expect(CLASS_BASE_TYPES.Resource).toBeUndefined();
    expect(CLASS_BASE_TYPES.Node).toBeUndefined();
  });

  it('reaches a resource ancestor', () => {
    expect(descendsFromClass('StandardMaterial3D', 'Material')).toBe(true);
    expect(descendsFromClass('ShaderMaterial', 'Material')).toBe(true);
    expect(descendsFromClass('Material', 'Material')).toBe(true);
  });

  it('answers false for a sibling branch and for a class it has never heard of', () => {
    expect(descendsFromClass('Texture2D', 'Material')).toBe(false);
    expect(descendsFromClass('Sky', 'Material')).toBe(false);
    expect(descendsFromClass('MeshInstance3D', 'Material')).toBe(false);
    expect(descendsFromClass('SomeGDExtensionThing', 'Material')).toBe(false);
  });

  it('reads no key off Object.prototype for a type name a .tscn chose', () => {
    expect(descendsFromClass('constructor', 'Material')).toBe(false);
    expect(descendsFromClass('__proto__', 'Material')).toBe(false);
  });
});

describe('findInClassChain', () => {
  it('returns the answer of the nearest class that gives one', () => {
    const visited: string[] = [];
    const found = findInClassChain('Sprite2D', (type) => {
      visited.push(type);
      return type === 'CanvasItem' ? type : undefined;
    });
    expect(found).toBe('CanvasItem');
    expect(visited).toEqual(['Sprite2D', 'Node2D', 'CanvasItem']);
  });

  it('returns undefined when no class in the chain answers', () => {
    expect(findInClassChain('StandardMaterial3D', () => undefined)).toBeUndefined();
  });

  it('visits only the class itself when neither table knows it (edge case)', () => {
    const visited: string[] = [];
    findInClassChain('__proto__', (type) => void visited.push(type));
    expect(visited).toEqual(['__proto__']);
  });
});

describe('classBaseChain', () => {
  it('walks a node chain and a resource chain alike, nearest first', () => {
    expect(classBaseChain('Sprite2D')).toEqual(['Node2D', 'CanvasItem', 'Node']);
    expect(classBaseChain('BoxMesh')).toEqual(['PrimitiveMesh', 'Mesh', 'Resource']);
  });

  it('gives a table terminal no ancestors', () => {
    expect(classBaseChain('Node')).toEqual([]);
    expect(classBaseChain('Resource')).toEqual([]);
  });

  it('gives an unknown class no ancestors', () => {
    expect(classBaseChain('NotAClass')).toEqual([]);
  });

  it('reads no key off Object.prototype for a type name a .tscn chose', () => {
    expect(classBaseChain('__proto__')).toEqual([]);
    expect(classBaseChain('constructor')).toEqual([]);
  });
});

describe('classInheritanceChain', () => {
  it('leads with the class, then its ancestry nearest first through Object', () => {
    expect(classInheritanceChain('Button')).toEqual([
      'Button',
      'BaseButton',
      'Control',
      'CanvasItem',
      'Node',
      'Object',
    ]);
  });

  it('walks a resource through RefCounted to Object', () => {
    expect(classInheritanceChain('StandardMaterial3D')).toEqual([
      'StandardMaterial3D',
      'BaseMaterial3D',
      'Material',
      'Resource',
      'RefCounted',
      'Object',
    ]);
  });

  it('continues past a table terminal and past RefCounted to Object', () => {
    expect(classInheritanceChain('Node')).toEqual(['Node', 'Object']);
    expect(classInheritanceChain('Resource')).toEqual(['Resource', 'RefCounted', 'Object']);
    expect(classInheritanceChain('RefCounted')).toEqual(['RefCounted', 'Object']);
    expect(classInheritanceChain('Object')).toEqual(['Object']);
  });

  it('is only the name for a class neither hierarchy knows (edge case)', () => {
    expect(classInheritanceChain('constructor')).toEqual(['constructor']);
    expect(classInheritanceChain('__proto__')).toEqual(['__proto__']);
  });
});

describe('descendsFromClass over the node tree', () => {
  it('walks every hop, not just the declared parent', () => {
    expect(descendsFromClass('Sprite2D', 'Node2D')).toBe(true);
    expect(descendsFromClass('Sprite2D', 'CanvasItem')).toBe(true);
    expect(descendsFromClass('Sprite2D', 'Node')).toBe(true);
  });

  it('counts a type as its own ancestor, the way ClassDB `is_class` does', () => {
    expect(descendsFromClass('Node2D', 'Node2D')).toBe(true);
  });

  it('is false for an unrelated ancestor', () => {
    // A name test such as `endsWith('3D')` answers true for both.
    expect(descendsFromClass('Sprite2D', 'Node3D')).toBe(false);
    expect(descendsFromClass('NavigationAgent3D', 'Node3D')).toBe(false);
  });

  it('is false for a class this build never heard of', () => {
    expect(descendsFromClass('SomeGDExtensionNode', 'Node')).toBe(false);
  });

  it('reads a prototype-named type as unknown, not as Object.prototype', () => {
    // The type name comes from the `.tscn`. Bare indexing answers `constructor`
    // with a function and `__proto__` with the prototype, either of which puts a
    // non-string into the walk's `string | undefined`.
    expect(descendsFromClass('__proto__', 'Node')).toBe(false);
    expect(descendsFromClass('constructor', 'Node')).toBe(false);
    expect(descendsFromClass('toString', 'Node')).toBe(false);
  });
});

describe('MAX_BASE_CHAIN_HOPS', () => {
  it('clears the deepest chain either catalog states, with slack', () => {
    // The bound only stops a malformed table from spinning. A chain that reaches it
    // is truncated in silence, which is the failure `descendsFromClass` cannot report.
    const deepest = (table: Readonly<Record<string, string>>): number =>
      Math.max(...Object.keys(table).map((type) => depth(table, type)));
    expect(deepest(NODE_BASE_TYPES)).toBeLessThan(MAX_BASE_CHAIN_HOPS);
    expect(deepest(RESOURCE_BASE_TYPES_GENERATED)).toBeLessThan(MAX_BASE_CHAIN_HOPS);
  });
});
