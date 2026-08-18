/**
 * The tuple and reference combinators: vectors, Rect2, Transform3D, resource
 * references, NodePath and Color — their shape checks, and the lenient float
 * grammar every one of them must accept.
 *
 * The scalar combinators are `v.test.ts`; the packed arrays and the string
 * grammars are `v.packedArrays.test.ts`.
 */

import { validatorRegistry } from '../ValidatorRegistry.js';
import '../index.js';
import { describe, expect, it } from 'vitest';
import { v } from './v.js';

describe('v.vector2 / v.vector2i / v.vector3', () => {
  it('vector2 accepts Vector2(x, y)', () => {
    expect(v.vector2('size')('size', 'Vector2(1.5, -2)', 1)).toBeNull();
  });

  it('vector2 rejects malformed', () => {
    const err = v.vector2('size')('size', 'Vector2(1)', 1);
    expect(err!.message).toContain('Vector2');
  });

  it('vector2i accepts integer pair', () => {
    expect(v.vector2i('grid')('grid', 'Vector2i(0, 0)', 1)).toBeNull();
  });

  // `_parse_construct<int32_t>` (variant_parser.cpp:577-592) takes any number
  // token and converts it, so a component Godot writes as a float or in
  // exponent notation loads and truncates toward zero. A `-?\d+` component
  // grammar reported a format error on a file Godot opens.
  it('vector2i takes the component spellings Godot converts', () => {
    // Whole-valued, however spelled: `2e1` is 20 and stores exactly.
    expect(v.vector2i('grid')('grid', 'Vector2i(2e1, 0)', 1)).toBeNull();
    // Fractional loads too, but the stored value is not the written one, so it
    // draws the truncation warning every int slot shares.
    expect(v.vector2i('grid')('grid', 'Vector2i(1.5, 0)', 1)?.severity).toBe('warning');
  });

  it('vector2i truncates a converted component toward zero before bounding it', () => {
    // Godot stores 0 here, which is below the floor; reading `-0.5` as -0 or
    // as -1 would answer differently.
    const validator = v.vector2i('size', { min: 1, enforced: 'viewport.cpp:1120' });
    // Below the floor once truncated: the ERROR, which outranks the warning.
    expect(validator('size', 'Vector2i(0.9, 4)', 1)?.severity).toBe('error');
    // In range once truncated: only the truncation itself is left to report.
    expect(validator('size', 'Vector2i(1.9, 4)', 1)?.severity).toBe('warning');
  });

  it('rect2i takes the same component spellings', () => {
    expect(v.rect2i('region')('region', 'Rect2i(0, 0, 2e1, 16)', 1)).toBeNull();
    expect(v.rect2i('region')('region', 'Rect2i(0, 0, abc, 16)', 1)).not.toBeNull();
  });

  it('rect2i follows the composite type, not the token, into the int32 branch', () => {
    // A `Rect2(...)` in a Rect2i slot holds four DOUBLES, so every component
    // narrows through `double -> int32` however it was spelled: `4294967295`
    // reaches the UB sentinel, while the `Rect2i` spelling of the same digits
    // wraps an int64 to -1. Measured on 4.6.3.
    const converted = v.rect2i('region')('region', 'Rect2(0, 0, 4294967295, 16)', 1);
    expect(converted?.severity).toBe('error');
    expect(converted?.code).toBe('INVALID_REGION_VALUE');
    expect(v.rect2i('region')('region', 'Rect2i(0, 0, 4294967295, 16)', 1)).toBeNull();
    expect(v.rect2i('region')('region', 'Rect2(0, 0, 320, 16)', 1)).toBeNull();
  });

  it('vector2i with a min rejects a component below it', () => {
    const err = v.vector2i('grid', { min: 0, enforced: 'window.cpp:1190' })('grid', 'Vector2i(-1, 0)', 1);
    expect(err!.code).toBe('INVALID_GRID_VALUE');
  });

  it('vector2i takes a min above zero, which a boolean flag could not express', () => {
    // Viewport::_set_size floors at 2, so a SubViewport sized 1 is altered
    // exactly as a negative one is.
    const validator = v.vector2i('size', { min: 2, enforced: 'viewport.cpp:1120' });
    expect(validator('size', 'Vector2i(1, 8)', 1)?.code).toBe('INVALID_SIZE_VALUE');
    expect(validator('size', 'Vector2i(2, 8)', 1)).toBeNull();
  });

  it('vector2i reports a hinted min as a warning and an enforced one as an error', () => {
    const hinted = v.vector2i('grid', { min: 0, hinted: 'window.cpp:3430' });
    expect(hinted('grid', 'Vector2i(-1, 0)', 1)?.severity).toBe('warning');
    const enforced = v.vector2i('grid', { min: 0, enforced: 'window.cpp:1716' });
    expect(enforced('grid', 'Vector2i(-1, 0)', 1)?.severity).toBe('error');
  });

  it('vector2i is never format-only: it rejects a component no int32 holds', () => {
    expect(v.vector2i('grid').formatOnly).toBeUndefined();
    expect(v.vector2i('grid').intSlot).toEqual({ cite: 'variant.h:360-377', width: 'int32' });
    expect(v.vector2i('grid', { min: 0, enforced: 'window.cpp:1190' }).formatOnly).toBeUndefined();
  });

  it('vector3 accepts triplet', () => {
    expect(v.vector3('position')('position', 'Vector3(0, 1, 2)', 1)).toBeNull();
  });
});

describe('v.rect2 / v.transform3d', () => {
  it('rect2 accepts 4-number rect', () => {
    expect(v.rect2('region')('region', 'Rect2(0, 0, 100, 100)', 1)).toBeNull();
  });

  it('transform3d accepts 12-number transform', () => {
    expect(
      v.transform3d('transform')(
        'transform',
        'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
        1
      )
    ).toBeNull();
  });

  it('transform3d rejects fewer numbers', () => {
    const err = v.transform3d('transform')('transform', 'Transform3D(1, 0)', 1);
    expect(err!.message).toContain('Transform3D');
  });
});

describe('v.resourceReference / v.nodePath / v.color', () => {
  it('resourceReference accepts SubResource and ExtResource', () => {
    expect(v.resourceReference('mesh')('mesh', 'SubResource("box")', 1)).toBeNull();
    expect(
      v.resourceReference('mesh')('mesh', 'ExtResource("1_texture")', 1)
    ).toBeNull();
  });

  it('resourceReference rejects raw paths', () => {
    const err = v.resourceReference('mesh')('mesh', 'res://foo.tres', 1);
    expect(err!.code).toBe('INVALID_MESH_REFERENCE');
  });

  it('nodePath accepts NodePath("…")', () => {
    expect(
      v.nodePath('skeleton')('skeleton', 'NodePath("../Armature")', 1)
    ).toBeNull();
  });

  it('color accepts 4-component Color', () => {
    expect(
      v.color('light_color')('light_color', 'Color(1, 0.5, 0, 1)', 1)
    ).toBeNull();
  });

  it('color rejects 3-component', () => {
    const err = v.color('light_color')('light_color', 'Color(1, 0, 0)', 1);
    expect(err!.message).toContain('4 numbers');
  });
});

describe('float-tuple validators speak the tokenizer float grammar (#190 drift fix)', () => {
  // FLOAT_PATTERN_SOURCE (godot/number.ts) is transcribed from `get_token`,
  // so linter and renderer accept exactly what Godot loads: trailing-dot (5.)
  // and every exponent form, but NOT a leading `+` or a leading `.` — measured
  // on 4.6.3, both fail the load outright.
  it('v.vector2 accepts 5. / scientific', () => {
    expect(v.vector2('offset')('offset', 'Vector2(0.5, 5.)', 1)).toBeNull();
    expect(v.vector2('offset')('offset', 'Vector2(1, -2.5e-2)', 1)).toBeNull();
  });

  it('refuses a leading plus and a leading dot, which Godot cannot read', () => {
    expect(v.vector2('offset')('offset', 'Vector2(+1, 2)', 1)).not.toBeNull();
    expect(v.vector2('offset')('offset', 'Vector2(.5, 2)', 1)).not.toBeNull();
  });

  it('v.vector3 accepts 5. / scientific', () => {
    expect(v.vector3('position')('position', 'Vector3(0.5, 5., 5)', 1)).toBeNull();
    expect(v.vector3('position')('position', 'Vector3(1e3, -2.5e-2, 0)', 1)).toBeNull();
  });

  it('v.rect2 accepts the tokenizer grammar', () => {
    expect(v.rect2('region')('region', 'Rect2(0.5, 5., 1, 2)', 1)).toBeNull();
  });

  it('v.transform3d accepts the tokenizer grammar', () => {
    expect(
      v.transform3d('t')('t', 'Transform3D(1., 0.5, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)', 1)
    ).toBeNull();
  });

  it('v.color accepts the tokenizer grammar', () => {
    expect(v.color('albedo_color')('albedo_color', 'Color(0.5, 1., 0, 1)', 1)).toBeNull();
  });

  it('v.aabb accepts the tokenizer grammar', () => {
    expect(v.aabb('aabb')('aabb', 'AABB(0.5, 5., 1, 1, 1, 1)', 1)).toBeNull();
  });

  it('v.quaternion accepts the tokenizer grammar', () => {
    expect(v.quaternion('q')('q', 'Quaternion(0.5, 5., 0, 1)', 1)).toBeNull();
  });

  it('v.transform2d accepts the tokenizer grammar', () => {
    expect(v.transform2d('t')('t', 'Transform2D(1., 0.5, 0, 1, 0, 0)', 1)).toBeNull();
  });

  it('v.basis accepts the tokenizer grammar', () => {
    expect(v.basis('b')('b', 'Basis(1., 0.5, 0, 0, 1, 0, 0, 0, 1)', 1)).toBeNull();
  });

  it('still rejects non-numeric and wrong-arity tuples', () => {
    expect(v.vector3('position')('position', 'Vector3(a, b, c)', 1)).not.toBeNull();
    expect(v.vector3('position')('position', 'Vector3(1, 2)', 1)).not.toBeNull();
    expect(v.color('c')('c', 'Color(1, 1, 1)', 1)).not.toBeNull();
  });
});

describe('a fractional component of an integer composite', () => {
  // `_parse_construct<int32_t>` (variant_parser.cpp:577-592) takes any number
  // token and narrows it, exactly as a scalar int slot does — so the truncation
  // warning must reach here too. It did not: the scalar `hframes = 5.5` warned
  // while `Vector2i(1.5, 2)` beside it said nothing.
  it('warns on Vector2i, as the scalar slot does', () => {
    const diagnostic = v.vector2i('size')('size', 'Vector2i(1.5, 2)', 1);
    expect(diagnostic?.severity).toBe('warning');
    expect(diagnostic?.message).toContain('1.5');
  });

  it('warns on Rect2i', () => {
    expect(v.rect2i('region')('region', 'Rect2i(0, 0, 3.5, 4)', 1)?.severity).toBe('warning');
  });

  it('warns on a packed int element', () => {
    // Through a real slice's validator, since the packed-int reader is composed
    // per slice rather than exposed as a `v` combinator.
    const validator = validatorRegistry.findValidator('CodeEdit', 'line_length_guidelines')!;
    const diagnostic = validator('line_length_guidelines', 'PackedInt32Array(1.5, 80)', 1);
    expect(diagnostic?.severity).toBe('warning');
    expect(diagnostic?.message).toContain('1.5');
  });

  it('says nothing when every component is whole', () => {
    expect(v.vector2i('size')('size', 'Vector2i(1, 2)', 1)).toBeNull();
    expect(v.vector2i('size')('size', 'Vector2i(1.0, 2.0)', 1)).toBeNull();
  });
});
