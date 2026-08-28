/**
 * The merged ancestry table, and the two ways merging it could go wrong.
 *
 * A spread keeps the last of a colliding pair silently, and a filtered capture
 * drops a hop silently. Both would show up as a property that stops being
 * validated in scenes nobody runs a test over, so each is pinned here.
 */

import { describe, expect, it } from 'vitest';
import { CLASS_BASE_TYPES, descendsFromClass } from './classBaseTypes.js';
import { NODE_BASE_TYPES } from './nodeBaseTypes.js';
import { RESOURCE_BASE_TYPES_GENERATED } from './resourceBaseTypes.generated.js';

describe('CLASS_BASE_TYPES', () => {
  it('merges two disjoint hierarchies, so nothing is overwritten', () => {
    const shared = Object.keys(NODE_BASE_TYPES).filter(
      (name) => name in RESOURCE_BASE_TYPES_GENERATED
    );
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

  it('walks the merged table, which the node-only walk cannot', () => {
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
