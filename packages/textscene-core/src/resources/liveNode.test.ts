/**
 * A live node's instance ref names an id in the file that authored it, so it resolves in the
 * node's own scope where it carries one, else in its group's.
 */
import { describe, expect, it } from 'vitest';
import type { SceneScope } from '../parser/types';
import { liveInstancePath, withFallbackScope, type LiveNode } from './liveNode';

const scopeWith = (id: string, path: string): SceneScope => ({
  externalResources: [{ id, type: 'PackedScene', path }],
  internalResources: [],
});

const node = (overrides: Partial<LiveNode>): LiveNode => ({
  name: 'Row',
  type: 'Node3D',
  properties: {},
  rawProperties: {},
  children: [],
  ...overrides,
});

describe('liveInstancePath', () => {
  it("resolves an instance ref in the group's scope", () => {
    const instance = node({ instance: 'ExtResource("1")' });
    expect(liveInstancePath(instance, scopeWith('1', 'res://group.tscn'))).toBe('res://group.tscn');
  });

  it("resolves a grafted node's ref in its own scope, not its group's", () => {
    const grafted = node({ instance: 'ExtResource("1")', scope: scopeWith('1', 'res://own.tscn') });
    expect(liveInstancePath(grafted, scopeWith('1', 'res://group.tscn'))).toBe('res://own.tscn');
  });

  it('resolves nothing for a node with no instance ref', () => {
    expect(liveInstancePath(node({}), scopeWith('1', 'res://group.tscn'))).toBeNull();
  });

  it('resolves nothing for an id the scope does not declare (error case)', () => {
    const instance = node({ instance: 'ExtResource("9")' });
    expect(liveInstancePath(instance, scopeWith('1', 'res://group.tscn'))).toBeNull();
  });
});

describe('withFallbackScope', () => {
  const fallback = scopeWith('1', 'res://fallback.tscn');

  it('stamps a node that carries no scope with the fallback', () => {
    expect(withFallbackScope(node({}), fallback).scope).toBe(fallback);
  });

  it('returns a node that carries a scope unchanged', () => {
    const own = node({ scope: scopeWith('1', 'res://own.tscn') });
    expect(withFallbackScope(own, fallback)).toBe(own);
  });
});
