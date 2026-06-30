/**
 * Tests for the resource-reference helpers: `parseResourceReference`
 * (raw `SubResource("id")` / `ExtResource("id")` parsing) and
 * `resolveInstancePath` (a Node's instance ref → `res://` path), the
 * single resolver shared by NodeDispatcher, useSubSceneChildren, and
 * the live-tree resolver (`resolveLiveNode`).
 */
import { describe, it, expect } from 'vitest';
import { parseResourceReference, resolveInstancePath } from './SubResourceResolver';
import type { TscnExternalResource } from '../parser/types';

const externalResources: readonly TscnExternalResource[] = [
  { id: '1_cube', path: 'res://child_cube.tscn', type: 'PackedScene' },
  { id: '2_frame', path: 'res://props/PhotoFrame.tscn', type: 'PackedScene' },
];

describe('parseResourceReference', () => {
  it('parses an ExtResource reference', () => {
    expect(parseResourceReference('ExtResource("1_cube")')).toEqual({
      type: 'ExtResource',
      id: '1_cube',
    });
  });

  it('parses a SubResource reference', () => {
    expect(parseResourceReference('SubResource("BoxMesh_abc")')).toEqual({
      type: 'SubResource',
      id: 'BoxMesh_abc',
    });
  });

  it('tolerates internal whitespace', () => {
    expect(parseResourceReference('ExtResource( "x" )')).toEqual({
      type: 'ExtResource',
      id: 'x',
    });
  });

  it('returns null for a non-reference string', () => {
    expect(parseResourceReference('res://scene.tscn')).toBeNull();
    expect(parseResourceReference('"just a string"')).toBeNull();
    expect(parseResourceReference('')).toBeNull();
  });
});

describe('resolveInstancePath', () => {
  it('resolves an ExtResource id to its registered path', () => {
    expect(resolveInstancePath('ExtResource("1_cube")', externalResources)).toBe(
      'res://child_cube.tscn'
    );
    expect(resolveInstancePath('ExtResource("2_frame")', externalResources)).toBe(
      'res://props/PhotoFrame.tscn'
    );
  });

  it('passes a raw res:// path through unchanged', () => {
    expect(resolveInstancePath('res://standalone.tscn', externalResources)).toBe(
      'res://standalone.tscn'
    );
    // res:// short-circuits before the registry, so an empty list is fine.
    expect(resolveInstancePath('res://standalone.tscn', [])).toBe('res://standalone.tscn');
  });

  it('returns null when the ExtResource id is not registered', () => {
    expect(resolveInstancePath('ExtResource("missing")', externalResources)).toBeNull();
    expect(resolveInstancePath('ExtResource("1_cube")', [])).toBeNull();
  });

  it('returns null for a reference that is not an ExtResource or res:// path', () => {
    expect(resolveInstancePath('SubResource("BoxMesh_abc")', externalResources)).toBeNull();
    expect(resolveInstancePath('not a reference', externalResources)).toBeNull();
    expect(resolveInstancePath('', externalResources)).toBeNull();
  });
});
