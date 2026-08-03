/**
 * Tests for the resource-reference helpers: `parseResourceReference`
 * (raw `SubResource("id")` / `ExtResource("id")` parsing), `resolveInstancePath`
 * (a Node's instance ref → `res://` path, the single resolver shared by
 * NodeDispatcher, useSubSceneChildren, and the live-tree resolver
 * `resolveLiveNode`), and `resolveSubResourceRef` (a raw `SubResource("id")`
 * property string → its internal resource, shared by the CollisionShape2D/3D
 * R3F components).
 */
import { describe, it, expect } from 'vitest';
import {
  parseResourceReference,
  resolveInstancePath,
  resolveSubResourceRef,
  resolveTexture2DSource,
  resolveTexture2DPath,
} from './SubResourceResolver';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types';

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

describe('resolveSubResourceRef', () => {
  const internalResources: readonly TscnInternalResource[] = [
    { id: 'RectangleShape2D_1', type: 'RectangleShape2D', data: { size: 'Vector2(40, 60)' } },
    { id: 'CircleShape2D_1', type: 'CircleShape2D', data: { radius: '15' } },
  ];

  it('resolves a SubResource reference to its internal resource (happy path)', () => {
    expect(resolveSubResourceRef('SubResource("RectangleShape2D_1")', internalResources)).toEqual(
      internalResources[0]
    );
  });

  it('returns undefined for an absent ref (edge case)', () => {
    expect(resolveSubResourceRef(undefined, internalResources)).toBeUndefined();
  });

  it('returns undefined for an ExtResource reference (error path — wrong reference kind)', () => {
    expect(resolveSubResourceRef('ExtResource("1_cube")', internalResources)).toBeUndefined();
  });

  it('returns undefined for a malformed reference (error path)', () => {
    expect(resolveSubResourceRef('not a reference', internalResources)).toBeUndefined();
  });

  it('returns undefined when the SubResource id is not registered (error path)', () => {
    expect(resolveSubResourceRef('SubResource("Missing_1")', internalResources)).toBeUndefined();
    expect(resolveSubResourceRef('SubResource("RectangleShape2D_1")', [])).toBeUndefined();
  });
});

describe('resolveTexture2DPath', () => {
  const externals: readonly TscnExternalResource[] = [
    { id: '5', path: 'res://godot.png', type: 'Texture2D' },
    { id: '6', path: 'res://godot_normal.png', type: 'Texture2D' },
  ];
  const internals: readonly TscnInternalResource[] = [
    {
      id: 'CanvasTexture_hlulo',
      type: 'CanvasTexture',
      data: {
        diffuse_texture: 'ExtResource("5")',
        normal_texture: 'ExtResource("6")',
        specular_shininess: '0.5',
      },
    },
    { id: 'Plain_1', type: 'PlaceholderTexture2D', data: {} },
    {
      id: 'AtlasTexture_coin',
      type: 'AtlasTexture',
      data: { atlas: 'ExtResource("5")', region: 'Rect2(20, 16, 40, 32)' },
    },
    {
      id: 'AtlasTexture_empty',
      type: 'AtlasTexture',
      data: { atlas: 'ExtResource("5")', region: 'Rect2(0, 0, 0, 32)' },
    },
  ];

  it('unwraps an AtlasTexture SubResource to its sheet plus the region', () => {
    expect(resolveTexture2DSource('SubResource("AtlasTexture_coin")', externals, internals)).toEqual({
      path: 'res://godot.png',
      region: { x: 20, y: 16, width: 40, height: 32 },
    });
    // The path half alone keeps the old contract for path-only consumers.
    expect(resolveTexture2DPath('SubResource("AtlasTexture_coin")', externals, internals)).toBe(
      'res://godot.png'
    );
  });

  it('drops an empty AtlasTexture region — Godot samples the whole sheet', () => {
    expect(resolveTexture2DSource('SubResource("AtlasTexture_empty")', externals, internals)).toEqual({
      path: 'res://godot.png',
    });
  });

  it('passes a raw res:// path through', () => {
    expect(resolveTexture2DPath('res://icon.png', externals, internals)).toBe('res://icon.png');
  });

  it('resolves an ExtResource reference', () => {
    expect(resolveTexture2DPath('ExtResource("5")', externals, internals)).toBe('res://godot.png');
  });

  it('unwraps a CanvasTexture SubResource to its diffuse_texture', () => {
    expect(resolveTexture2DPath('SubResource("CanvasTexture_hlulo")', externals, internals)).toBe(
      'res://godot.png'
    );
  });

  it('returns null for a SubResource that carries no diffuse texture', () => {
    expect(resolveTexture2DPath('SubResource("Plain_1")', externals, internals)).toBeNull();
  });

  it('returns null for an unknown id, a malformed ref, and an absent value', () => {
    expect(resolveTexture2DPath('SubResource("nope")', externals, internals)).toBeNull();
    expect(resolveTexture2DPath('not a reference', externals, internals)).toBeNull();
    expect(resolveTexture2DPath(undefined, externals, internals)).toBeNull();
  });
});
