/**
 * The pre-4.0 property names Godot's `_set` overrides still accept. Each entry names the property
 * the setter writes and, where the arm gates or transforms, the value it receives.
 */

import { describe, expect, it } from 'vitest';
import {
  canonicalPropertyName,
  canonicalisePropertyBag,
  isDeprecatedPropertyName,
  resolveDeprecatedProperty,
} from './deprecated.js';

describe('canonicalPropertyName', () => {
  it('maps `frames` to the sprite_frames setter, both dimensions', () => {
    expect(canonicalPropertyName('AnimatedSprite2D', 'frames', '1')).toBe('sprite_frames');
    expect(canonicalPropertyName('AnimatedSprite3D', 'frames', '1')).toBe('sprite_frames');
  });

  it("maps Label's align pair to the alignment setters", () => {
    expect(canonicalPropertyName('Label', 'align', '1')).toBe('horizontal_alignment');
    expect(canonicalPropertyName('Label', 'valign', '1')).toBe('vertical_alignment');
  });

  it('leaves a current name alone', () => {
    expect(canonicalPropertyName('AnimatedSprite2D', 'sprite_frames', '1')).toBe('sprite_frames');
    expect(canonicalPropertyName('Sprite2D', 'texture', '1')).toBe('texture');
  });

  it('does not apply one type’s alias to another', () => {
    // `_set` is a virtual on the declaring class, so `Label.align` says nothing about any other
    // Control, and `frames` is a current property name on types that do not alias it.
    expect(canonicalPropertyName('Button', 'align', '1')).toBe('align');
    expect(canonicalPropertyName('Sprite2D', 'frames', '1')).toBe('frames');
  });

  it('reports which spellings are deprecated', () => {
    expect(isDeprecatedPropertyName('Label', 'align')).toBe(true);
    expect(isDeprecatedPropertyName('Label', 'horizontal_alignment')).toBe(false);
  });
});

describe('a property key that collides with Object.prototype', () => {
  // A `.tscn` chooses these strings, and a plain object literal answers `constructor`,
  // `__proto__` or `toString` from its prototype chain with a function.
  it.each(['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty'])(
    'returns %s unchanged rather than a prototype member',
    (key) => {
      expect(canonicalPropertyName('Label', key, '1')).toBe(key);
    }
  );

  it('is not fooled by a node type that collides either', () => {
    expect(canonicalPropertyName('constructor', 'frames', '1')).toBe('frames');
    expect(canonicalPropertyName('__proto__', 'align', '1')).toBe('align');
  });

  it('reports such a key as not deprecated', () => {
    expect(isDeprecatedPropertyName('Label', 'constructor')).toBe(false);
    expect(isDeprecatedPropertyName('constructor', 'align')).toBe(false);
  });
});

describe('the Godot-3 navigation vocabulary', () => {
  // Most overrides compare against a bare string, not `p_name == SNAME(...)`, and all of
  // these do.
  it.each([
    ['NavigationRegion2D', 'navpoly', 'navigation_polygon'],
    ['NavigationRegion3D', 'navmesh', 'navigation_mesh'],
    ['NavigationLink2D', 'start_location', 'start_position'],
    ['NavigationLink3D', 'end_location', 'end_position'],
    ['NavigationAgent2D', 'target_location', 'target_position'],
    ['NavigationAgent3D', 'agent_height_offset', 'path_height_offset'],
    ['RichTextLabel', 'bbcode_text', 'text'],
    ['PointLight2D', 'mode', 'blend_mode'],
  ])('%s.%s resolves to %s', (type, old, canonical) => {
    expect(canonicalPropertyName(type, old, '1')).toBe(canonical);
  });
});

describe('an alias a slice already handles is deliberately absent', () => {
  // Two mechanisms for one alias is worse than either. AnimationPlayer reads
  // `active ?? playback_active` in its own parser and registers validators
  // under the deprecated names; canonicalising underneath it changed which of
  // two conflicting values won.
  it.each([['playback_active'], ['method_call_mode'], ['playback_process_mode']])(
    'AnimationPlayer.%s is left to the slice',
    (key) => {
      expect(canonicalPropertyName('AnimationPlayer', key, '1')).toBe(key);
    }
  );

  it('AnimationTree.process_callback is left to the slice too', () => {
    // animation_tree.cpp:926-927 is its own `_set` arm, not an inherited one,
    // and the slice registers a validator under the deprecated spelling
    // (animationtree/linterParser.ts) exactly as AnimationPlayer's does.
    expect(canonicalPropertyName('AnimationTree', 'process_callback', '1')).toBe(
      'process_callback'
    );
  });
});

describe('an arm the table cannot express is deliberately absent', () => {
  // `BaseMaterial3D::_set` maps a Godot-3 flag onto an enum setter through a
  // table of its own; nothing here reads the canonical key, so no row.
  it('StandardMaterial3D.flags_transparent is left alone', () => {
    expect(canonicalPropertyName('StandardMaterial3D', 'flags_transparent', 'true')).toBe(
      'flags_transparent'
    );
  });
});

/**
 * `set_size((Vector3)p_value * 2)`: the Godot-3 half-extents doubled into
 * `size`. Measured on 4.6.3: `BoxShape3D extents = Vector3i(3, 1, 3)` loads as
 * size (6, 2, 6); `RectangleShape2D extents = Vector2(16, 8)` as (32, 16);
 * `Decal extents = Vector3(1, 2, 3)` as (2, 4, 6).
 */
describe('the half-extents family', () => {
  it.each([
    ['BoxShape3D', 'box_shape_3d.cpp:81-83'],
    ['Decal', 'decal.cpp:274-276'],
    ['ReflectionProbe', 'reflection_probe.cpp:288-290'],
    ['FogVolume', 'fog_volume.cpp:60-62'],
    ['VoxelGI', 'voxel_gi.cpp:241-243'],
    ['GPUParticlesCollisionBox3D', 'gpu_particles_collision_3d.cpp:106-108'],
    ['GPUParticlesCollisionSDF3D', 'gpu_particles_collision_3d.cpp:571-573'],
    ['GPUParticlesCollisionHeightField3D', 'gpu_particles_collision_3d.cpp:753-755'],
    ['GPUParticlesAttractorBox3D', 'gpu_particles_collision_3d.cpp:957-959'],
    ['GPUParticlesAttractorVectorField3D', 'gpu_particles_collision_3d.cpp:1009-1011'],
  ])('%s.extents is size doubled (%s)', (type) => {
    expect(resolveDeprecatedProperty(type, 'extents', 'Vector3(3, 1, 3)')).toEqual({
      key: 'size',
      value: 'Vector3(6, 2, 6)',
    });
  });

  it('RectangleShape2D.extents is size doubled (rectangle_shape_2d.cpp:42-44)', () => {
    expect(resolveDeprecatedProperty('RectangleShape2D', 'extents', 'Vector2(16, 8)')).toEqual({
      key: 'size',
      value: 'Vector2(32, 16)',
    });
  });

  it('converts the i-suffixed spelling the cast accepts into the float jacket', () => {
    expect(resolveDeprecatedProperty('BoxShape3D', 'extents', 'Vector3i(3, 1, 3)').value).toBe(
      'Vector3(6, 2, 6)'
    );
  });

  it('renames a literal the grammar refuses without rewriting it', () => {
    // The decoder's own fallback answers for it, as for a malformed `size`.
    expect(resolveDeprecatedProperty('Decal', 'extents', 'Vector2(1, 2)')).toEqual({
      key: 'size',
      value: 'Vector2(1, 2)',
    });
  });

  it('keys by the declaring type: extents elsewhere is not an alias', () => {
    expect(canonicalPropertyName('SphereShape3D', 'extents', 'Vector3(1, 1, 1)')).toBe('extents');
    expect(canonicalPropertyName('GPUParticlesCollisionSphere3D', 'extents', '1')).toBe('extents');
    expect(isDeprecatedPropertyName('Marker3D', 'extents')).toBe(false);
  });
});

/**
 * `_set` gated on `bool(p_value)`, writing a fixed enum member. Measured on 4.6.3 from a
 * non-default baseline: after `gi_mode = 0`, `use_in_baked_light = true` loads 1, `use_dynamic_gi`
 * 2, a false or `0` nothing. After `expand_mode = 3`, `expand = false` stays 3, while `expand = true`,
 * `ignore_texture_size = 2` and `expand = "yes"` load as 1.
 */
describe('a bool-gated arm that writes an enum member', () => {
  it('TextureRect.expand / ignore_texture_size write EXPAND_IGNORE_SIZE (texture_rect.cpp:171-173)', () => {
    expect(resolveDeprecatedProperty('TextureRect', 'expand', 'true')).toEqual({ key: 'expand_mode', value: '1' });
    expect(resolveDeprecatedProperty('TextureRect', 'ignore_texture_size', '2')).toEqual({
      key: 'expand_mode',
      value: '1',
    });
    expect(resolveDeprecatedProperty('TextureRect', 'expand', '"yes"').key).toBe('expand_mode');
  });

  it('drops a falsy value: the key stays under its own spelling', () => {
    expect(resolveDeprecatedProperty('TextureRect', 'expand', 'false')).toEqual({ key: 'expand', value: 'false' });
    expect(resolveDeprecatedProperty('TextureRect', 'expand', '0')).toEqual({ key: 'expand', value: '0' });
    expect(resolveDeprecatedProperty('TextureRect', 'expand', '""').key).toBe('expand');
  });

  it('GeometryInstance3D.use_in_baked_light / use_dynamic_gi write gi_mode (visual_instance_3d.cpp:323-330)', () => {
    expect(resolveDeprecatedProperty('GeometryInstance3D', 'use_in_baked_light', 'true')).toEqual({
      key: 'gi_mode',
      value: '1',
    });
    expect(resolveDeprecatedProperty('GeometryInstance3D', 'use_dynamic_gi', 'true')).toEqual({
      key: 'gi_mode',
      value: '2',
    });
    expect(resolveDeprecatedProperty('GeometryInstance3D', 'use_dynamic_gi', '0').key).toBe('use_dynamic_gi');
  });

  it('does not let a refused value clear the canonical key beside it', () => {
    const bag = canonicalisePropertyBag('TextureRect', { expand_mode: '3', expand: 'false' });
    expect(bag.expand_mode).toBe('3');
  });
});

/**
 * `_setv` (`object.h:429-437`) calls the base class first, so an alias declared
 * on a base applies to every descendant.
 */
describe('an alias declared on an ancestor', () => {
  it.each(['MeshInstance3D', 'CSGBox3D', 'Label3D', 'Sprite3D', 'SoftBody3D', 'GPUParticles3D'])(
    '%s inherits GeometryInstance3D.use_in_baked_light',
    (type) => {
      expect(resolveDeprecatedProperty(type, 'use_in_baked_light', 'true')).toEqual({ key: 'gi_mode', value: '1' });
      expect(isDeprecatedPropertyName(type, 'use_dynamic_gi')).toBe(true);
    }
  );

  it('does not reach a type outside the chain', () => {
    expect(canonicalPropertyName('Node3D', 'use_in_baked_light', 'true')).toBe('use_in_baked_light');
    expect(canonicalPropertyName('Sprite2D', 'use_dynamic_gi', 'true')).toBe('use_dynamic_gi');
  });

  it('canonicalises a whole bag on a descendant type', () => {
    expect(canonicalisePropertyBag('MeshInstance3D', { use_in_baked_light: 'true' })).toEqual({ gi_mode: '1' });
  });
});

describe('pure renames measured on 4.6.3', () => {
  it('TileMap.cell_quadrant_size is rendering_quadrant_size (tile_map.cpp:695-697)', () => {
    // 32 loads as rendering_quadrant_size 32. The setter refuses 0 (tile_map.cpp:224), which
    // stays 16, the canonical validator's floor.
    expect(resolveDeprecatedProperty('TileMap', 'cell_quadrant_size', '32')).toEqual({
      key: 'rendering_quadrant_size',
      value: '32',
    });
    expect(canonicalPropertyName('TileMap', 'cell_quadrant_size', '0')).toBe('rendering_quadrant_size');
    expect(canonicalPropertyName('TileMapLayer', 'cell_quadrant_size', '0')).toBe('cell_quadrant_size');
  });

  it('Bone2D.default_length is length (skeleton_2d.cpp:48-49)', () => {
    expect(resolveDeprecatedProperty('Bone2D', 'default_length', '12')).toEqual({ key: 'length', value: '12' });
  });

  it('TileSetAtlasSource x:y/alt/texture_offset is texture_origin (tile_set.cpp:4812, :6702-6704)', () => {
    // Measured: `0:0/0/texture_offset = Vector2i(3, 4)` loads as texture_origin (3, 4).
    expect(resolveDeprecatedProperty('TileSetAtlasSource', '0:0/0/texture_offset', 'Vector2i(3, 4)')).toEqual({
      key: '0:0/0/texture_origin',
      value: 'Vector2i(3, 4)',
    });
    expect(canonicalPropertyName('TileSetAtlasSource', '-1:2/+3/texture_offset', '1')).toBe('-1:2/+3/texture_origin');
    expect(isDeprecatedPropertyName('TileSetAtlasSource', '2:1/0/texture_offset')).toBe(true);
  });

  it('leaves a key the index gate refuses, and the bare leaf, alone', () => {
    expect(canonicalPropertyName('TileSetAtlasSource', 'a:b/0/texture_offset', '1')).toBe('a:b/0/texture_offset');
    expect(canonicalPropertyName('TileSetAtlasSource', 'texture_offset', '1')).toBe('texture_offset');
    expect(canonicalPropertyName('TileSetAtlasSource', '0:0/texture_offset', '1')).toBe('0:0/texture_offset');
  });
});

describe('canonicalisePropertyBag', () => {
  it('renames every deprecated key against a type the scanner learned late', () => {
    expect(
      canonicalisePropertyBag('AnimatedSprite2D', { frames: 'SubResource("1")', flip_h: 'true' })
    ).toEqual({ sprite_frames: 'SubResource("1")', flip_h: 'true' });
  });

  it('returns the same bag untouched for a type with no aliases', () => {
    const raw = { texture: 'ExtResource("1")' };
    expect(canonicalisePropertyBag('Sprite2D', raw)).toBe(raw);
    expect(canonicalisePropertyBag(undefined, raw)).toBe(raw);
  });

  it('does not invent keys from Object.prototype', () => {
    expect(canonicalisePropertyBag('Label', { constructor: '5' })).toEqual({ constructor: '5' });
  });
});

/**
 * Two `_set` arms gate on the value and return false for the rest. `_setv` then finds no
 * property under the deprecated name, so Godot drops the write rather than apply it.
 */
describe('an alias whose _set arm refuses the value', () => {
  it('keeps an empty bbcode_text off RichTextLabel.text', () => {
    // rich_text_label.cpp:7563: `!((String)p_value).is_empty()`.
    expect(canonicalPropertyName('RichTextLabel', 'bbcode_text', '""')).toBe('bbcode_text');
    expect(canonicalPropertyName('RichTextLabel', 'bbcode_text', '"Hello"')).toBe('text');
  });

  it('keeps a non-numeric PointLight2D.mode off blend_mode', () => {
    // light_2d.cpp:456-458: `p_value.is_num()`. A quoted value is a STRING and `true` a BOOL,
    // and neither is num.
    expect(canonicalPropertyName('PointLight2D', 'mode', '"add"')).toBe('mode');
    expect(canonicalPropertyName('PointLight2D', 'mode', 'true')).toBe('mode');
    expect(canonicalPropertyName('PointLight2D', 'mode', '1')).toBe('blend_mode');
    expect(canonicalPropertyName('PointLight2D', 'mode', '1.0')).toBe('blend_mode');
  });

  it('keeps a `+`-signed PointLight2D.mode off blend_mode, since no file loads it', () => {
    // `get_token` consumes only `-` before the digit test (variant_parser.cpp:420-424), and `+`
    // falls to "Unexpected character" (:508-510), so `mode = +5` fails the file's parse. A rename
    // would hide the deprecated spelling's validator and name a property the file lacks.
    expect(canonicalPropertyName('PointLight2D', 'mode', '+5')).toBe('mode');
    expect(canonicalPropertyName('PointLight2D', 'mode', '+1.5')).toBe('mode');
  });

  it('still forwards every spelling the tokenizer reads as a number', () => {
    for (const value of ['0', '-5', '2e1', '5.', '-1.25', 'inf', 'nan']) {
      expect(canonicalPropertyName('PointLight2D', 'mode', value)).toBe('blend_mode');
    }
  });

  it('does not let a refused value clear the canonical key beside it', () => {
    const bag = canonicalisePropertyBag('RichTextLabel', { text: '"Hello"', bbcode_text: '""' });
    expect(bag.text).toBe('"Hello"');
  });
});
