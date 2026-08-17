/**
 * The pre-4.0 property names Godot's `_set` overrides still accept.
 *
 * Table-only: the resolver has no behaviour beyond the lookup, so what is worth
 * pinning is that each entry names the property the setter actually writes.
 */

import { describe, expect, it } from 'vitest';
import {
  canonicalPropertyName,
  canonicalisePropertyBag,
  isDeprecatedPropertyName,
} from './deprecated.js';

describe('canonicalPropertyName', () => {
  it('maps `frames` to the sprite_frames setter, both dimensions', () => {
    expect(canonicalPropertyName('AnimatedSprite2D', 'frames')).toBe('sprite_frames');
    expect(canonicalPropertyName('AnimatedSprite3D', 'frames')).toBe('sprite_frames');
  });

  it("maps Label's align pair to the alignment setters", () => {
    expect(canonicalPropertyName('Label', 'align')).toBe('horizontal_alignment');
    expect(canonicalPropertyName('Label', 'valign')).toBe('vertical_alignment');
  });

  it('leaves a current name alone', () => {
    expect(canonicalPropertyName('AnimatedSprite2D', 'sprite_frames')).toBe('sprite_frames');
    expect(canonicalPropertyName('Sprite2D', 'texture')).toBe('texture');
  });

  it('does not apply one type’s alias to another', () => {
    // `_set` is a virtual on the declaring class, so `Label.align` says nothing
    // about any other Control — and `frames` is a real, current property name
    // on SpriteFrames-adjacent types that do not alias it.
    expect(canonicalPropertyName('Button', 'align')).toBe('align');
    expect(canonicalPropertyName('Sprite2D', 'frames')).toBe('frames');
  });

  it('reports which spellings are deprecated', () => {
    expect(isDeprecatedPropertyName('Label', 'align')).toBe(true);
    expect(isDeprecatedPropertyName('Label', 'horizontal_alignment')).toBe(false);
  });
});

describe('a property key that collides with Object.prototype', () => {
  // A `.tscn` chooses these strings, and a plain object literal answers
  // `constructor`/`__proto__`/`toString` from the prototype chain — so the
  // declared `: string` return handed back a FUNCTION and the linter threw
  // `propertyKey.startsWith is not a function` on a four-line scene.
  it.each(['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty'])(
    'returns %s unchanged rather than a prototype member',
    (key) => {
      expect(canonicalPropertyName('Label', key)).toBe(key);
    }
  );

  it('is not fooled by a node type that collides either', () => {
    expect(canonicalPropertyName('constructor', 'frames')).toBe('frames');
    expect(canonicalPropertyName('__proto__', 'align')).toBe('align');
  });

  it('reports such a key as not deprecated', () => {
    expect(isDeprecatedPropertyName('Label', 'constructor')).toBe(false);
    expect(isDeprecatedPropertyName('constructor', 'align')).toBe(false);
  });
});

describe('the Godot-3 navigation vocabulary', () => {
  // The first table was grepped for `p_name == SNAME(...)` and missed every
  // override that compares against a bare string — which is most of them, and
  // all of these. The false positive this table exists to remove was still
  // shipping on NavigationRegion2D.
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
    expect(canonicalPropertyName(type, old)).toBe(canonical);
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
      expect(canonicalPropertyName('AnimationPlayer', key)).toBe(key);
    }
  );
});

describe('an alias that TRANSFORMS the value is deliberately absent', () => {
  // `Decal::_set` maps `extents` to `set_size(p_value * 2)`. Renaming the key
  // would make the linter validate the right slot while the renderer read a
  // box twice the size the file describes — a transform needs code, not a row.
  it.each([
    ['Decal', 'extents'],
    ['RectangleShape2D', 'extents'],
    ['BoxShape3D', 'extents'],
    ['VoxelGI', 'extents'],
    ['StandardMaterial3D', 'flags_transparent'],
    ['GeometryInstance3D', 'use_in_baked_light'],
  ])('%s.%s is left alone', (type, key) => {
    expect(canonicalPropertyName(type, key)).toBe(key);
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
