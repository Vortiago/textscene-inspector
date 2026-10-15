import { describe, expect, it } from 'vitest';
import { baseChain } from './baseChain.js';

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
