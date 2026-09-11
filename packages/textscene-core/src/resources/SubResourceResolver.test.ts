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
  resolveExtAtlasTexturePath,
  resolveInstancePath,
  resolveSubResourceRef,
  resolveTexture2DPath,
  unwrapCanvasTextureRef,
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

describe('unwrapCanvasTextureRef', () => {
  const internals: readonly TscnInternalResource[] = [
    {
      id: 'CanvasTexture_outer',
      type: 'CanvasTexture',
      data: { diffuse_texture: 'SubResource("CanvasTexture_middle")' },
    },
    {
      id: 'CanvasTexture_middle',
      type: 'CanvasTexture',
      data: { diffuse_texture: 'SubResource("CanvasTexture_inner")' },
    },
    {
      id: 'CanvasTexture_inner',
      type: 'CanvasTexture',
      data: { diffuse_texture: 'ExtResource("5")' },
    },
    { id: 'CanvasTexture_empty', type: 'CanvasTexture', data: {} },
    {
      id: 'CanvasTexture_self',
      type: 'CanvasTexture',
      data: { diffuse_texture: 'SubResource("CanvasTexture_self")' },
    },
    { id: 'Gradient_1', type: 'GradientTexture2D', data: { width: '160', height: '96' } },
  ];

  it('passes a reference that is not a wrapper straight through', () => {
    expect(unwrapCanvasTextureRef('res://icon.png', internals)).toBe('res://icon.png');
    expect(unwrapCanvasTextureRef('SubResource("Gradient_1")', internals)).toBe(
      'SubResource("Gradient_1")'
    );
  });

  it('peels a chain of wrappers to the first reference that is not one', () => {
    // THREE levels: two peels is what the callers used to spell out by hand, so
    // only a third distinguishes a fixed point from a fixed count.
    expect(unwrapCanvasTextureRef('SubResource("CanvasTexture_outer")', internals)).toBe(
      'ExtResource("5")'
    );
  });

  it('is idempotent, so a caller can apply it to an already-peeled reference', () => {
    const once = unwrapCanvasTextureRef('SubResource("CanvasTexture_outer")', internals);
    expect(unwrapCanvasTextureRef(once, internals)).toBe(once);
  });

  it('names nothing to draw for an empty wrapper or one that leads back to itself', () => {
    expect(unwrapCanvasTextureRef('SubResource("CanvasTexture_empty")', internals)).toBeUndefined();
    expect(unwrapCanvasTextureRef('SubResource("CanvasTexture_self")', internals)).toBeUndefined();
    expect(unwrapCanvasTextureRef(undefined, internals)).toBeUndefined();
  });
});

describe('resolveExtAtlasTexturePath', () => {
  const externals: readonly TscnExternalResource[] = [
    { id: '1_atlas', type: 'AtlasTexture', path: 'res://icons/keyboard_arrow_left.tres' },
    { id: '2_sheet', type: 'Texture2D', path: 'res://sheet.png' },
  ];

  it('gives the path of an ExtResource declared AtlasTexture', () => {
    expect(resolveExtAtlasTexturePath('ExtResource("1_atlas")', externals)).toBe(
      'res://icons/keyboard_arrow_left.tres'
    );
  });

  it('declines an ExtResource declared a different type', () => {
    expect(resolveExtAtlasTexturePath('ExtResource("2_sheet")', externals)).toBeNull();
  });

  it('declines a SubResource, an unknown id, a malformed ref, and an absent value', () => {
    expect(resolveExtAtlasTexturePath('SubResource("1_atlas")', externals)).toBeNull();
    expect(resolveExtAtlasTexturePath('ExtResource("404")', externals)).toBeNull();
    expect(resolveExtAtlasTexturePath('not a reference', externals)).toBeNull();
    expect(resolveExtAtlasTexturePath(undefined, externals)).toBeNull();
  });
});

describe('resolveTexture2DPath', () => {
  const externals: readonly TscnExternalResource[] = [
    { id: '5', path: 'res://godot.png', type: 'Texture2D' },
    { id: '6', path: 'res://godot_normal.png', type: 'Texture2D' },
    { id: '7', path: 'res://icons/keyboard_arrow_left.tres', type: 'AtlasTexture' },
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
      id: 'CanvasTexture_atlas',
      type: 'CanvasTexture',
      data: { diffuse_texture: 'ExtResource("7")' },
    },
  ];

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

  it('declines an ExtResource AtlasTexture .tres, directly or through a CanvasTexture — its size is the region, never the sheet', () => {
    expect(resolveTexture2DPath('ExtResource("7")', externals, internals)).toBeNull();
    expect(resolveTexture2DPath('SubResource("CanvasTexture_atlas")', externals, internals)).toBeNull();
  });
});
