/**
 * resolveGlobalTransform2D climbs a caller's parent lookup through Godot's canvas parent
 * chain: it stops above a `top_level` node and below a parent that is not a CanvasItem,
 * and declines a chain it cannot decode.
 */
import { describe, expect, it } from 'vitest';
import { resolveGlobalTransform2D } from './globalTransform2D';
import type { ParentLookup } from '../../../linter/parentType';
import type { RawNode } from '../../../parser/types';

function node(type: string, rawProperties: Record<string, string> = {}): RawNode {
  return { name: type, type, children: [], rawProperties };
}

/** A parent lookup over a chain written root first. */
function chainOf(...chain: RawNode[]): (child: RawNode) => ParentLookup {
  return (child) => {
    const parent = chain[chain.indexOf(child) - 1];
    return parent ? { kind: 'known', parent } : { kind: 'root' };
  };
}

function originOf(target: RawNode, parentOf: (child: RawNode) => ParentLookup) {
  const verdict = resolveGlobalTransform2D(target, parentOf);
  return verdict.kind === 'known' ? { x: verdict.transform.tx, y: verdict.transform.ty } : verdict.kind;
}

describe('resolveGlobalTransform2D', () => {
  it('composes every Node2D ancestor up to the root', () => {
    const root = node('Node2D', { position: 'Vector2(100, 50)', scale: 'Vector2(2, 2)' });
    const target = node('Node2D', { position: 'Vector2(10, 5)' });
    expect(originOf(target, chainOf(root, target))).toEqual({ x: 120, y: 60 });
  });

  it('composes a top_level ancestor and stops above it', () => {
    const root = node('Node2D', { position: 'Vector2(1000, 1000)' });
    const detached = node('Node2D', { position: 'Vector2(100, 50)', top_level: 'true' });
    const target = node('Node2D', { position: 'Vector2(10, 5)' });
    expect(originOf(target, chainOf(root, detached, target))).toEqual({ x: 110, y: 55 });
  });

  it('stops below a parent that is not a CanvasItem', () => {
    const root = node('Node2D', { position: 'Vector2(100, 50)' });
    const target = node('Node2D', { position: 'Vector2(10, 5)' });
    expect(originOf(target, chainOf(root, node('Node'), target))).toEqual({ x: 10, y: 5 });
  });

  it('reads a node with no position as the identity', () => {
    const root = node('Node2D', { position: 'Vector2(100, 50)' });
    const target = node('Node2D');
    expect(originOf(target, chainOf(root, target))).toEqual({ x: 100, y: 50 });
  });

  it('declines a chain through a Control', () => {
    const target = node('Node2D', { position: 'Vector2(10, 5)' });
    expect(originOf(target, chainOf(node('Control'), target))).toBe('unknowable');
  });

  it('declines a chain through a parent the lookup cannot type', () => {
    const target = node('Node2D', { position: 'Vector2(10, 5)' });
    expect(originOf(target, () => ({ kind: 'unknowable' }))).toBe('unknowable');
  });
});
