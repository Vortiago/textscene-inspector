/**
 * Unit tests for the declarative validator namespace `v`.
 *
 * Each combinator is exercised on its happy path + at least one edge
 * (NaN, out-of-range, wrong format). The asserts pin message text the
 * same way the per-node `linter.test.ts` files do (`toContain` rather
 * than `toBe`) so they survive small wording tweaks without breaking.
 */

import { describe, expect, it } from 'vitest';
import { v } from './v.js';

describe('v.float', () => {
  it('passes when in range', () => {
    expect(v.float('fov', { min: 1, max: 179 })('fov', '90', 1)).toBeNull();
  });

  it('rejects NaN with format code', () => {
    const err = v.float('fov', { min: 1, max: 179 })('fov', 'oops', 5);
    expect(err).not.toBeNull();
    expect(err!.code).toBe('INVALID_FOV_FORMAT');
    expect(err!.line).toBe(5);
    expect(err!.message).toContain('fov');
    expect(err!.message).toContain('number');
  });

  it('rejects below min with value code', () => {
    const err = v.float('fov', { min: 1, max: 179 })('fov', '0.5', 1);
    expect(err!.code).toBe('INVALID_FOV_VALUE');
  });

  it('rejects above max with value code', () => {
    const err = v.float('fov', { min: 1, max: 179 })('fov', '200', 1);
    expect(err!.code).toBe('INVALID_FOV_VALUE');
  });

  it('accepts any number when no bounds set', () => {
    expect(v.float('offset')('offset', '-12.5', 1)).toBeNull();
    expect(v.float('offset')('offset', '0', 1)).toBeNull();
    expect(v.float('offset')('offset', 'not-a-number', 1)?.code).toBe(
      'INVALID_OFFSET_FORMAT'
    );
  });
});

describe('v.nonNegativeFloat', () => {
  it('accepts zero and positive', () => {
    expect(v.nonNegativeFloat('shadow_blur')('shadow_blur', '0', 1)).toBeNull();
    expect(v.nonNegativeFloat('shadow_blur')('shadow_blur', '12.5', 1)).toBeNull();
  });

  it('rejects negative', () => {
    const err = v.nonNegativeFloat('shadow_blur')('shadow_blur', '-1', 1);
    expect(err!.message).toContain('shadow_blur');
    expect(err!.message).toContain('non-negative');
  });
});

describe('v.positiveFloat', () => {
  it('rejects zero', () => {
    const err = v.positiveFloat('near')('near', '0', 1);
    expect(err).not.toBeNull();
    expect(err!.message).toContain('near');
  });

  it('accepts positive', () => {
    expect(v.positiveFloat('near')('near', '0.5', 1)).toBeNull();
  });
});

describe('v.int', () => {
  it('parses base 10', () => {
    expect(v.int('layers', { min: 1, max: 20 })('layers', '15', 1)).toBeNull();
  });

  it('rejects out-of-range', () => {
    const err = v.int('layers', { min: 1, max: 20 })('layers', '21', 1);
    expect(err!.code).toBe('INVALID_LAYERS_VALUE');
  });
});

describe('v.positiveInt', () => {
  it('accepts > 0', () => {
    expect(v.positiveInt('count')('count', '5', 1)).toBeNull();
  });

  it('rejects 0 and negative', () => {
    expect(v.positiveInt('count')('count', '0', 1)).not.toBeNull();
    expect(v.positiveInt('count')('count', '-3', 1)).not.toBeNull();
  });
});

describe('v.enumInt', () => {
  it('accepts values in range', () => {
    const labels = { 0: 'OFF', 1: 'ON', 2: 'DOUBLE_SIDED', 3: 'SHADOWS_ONLY' };
    const validator = v.enumInt('cast_shadow', 0, 3, labels);
    for (const value of [0, 1, 2, 3]) {
      expect(validator('cast_shadow', String(value), 1)).toBeNull();
    }
  });

  it('rejects out-of-range with labelled message', () => {
    const labels = { 0: 'OFF', 1: 'ON', 2: 'DOUBLE_SIDED', 3: 'SHADOWS_ONLY' };
    const err = v.enumInt('cast_shadow', 0, 3, labels)('cast_shadow', '99', 1);
    expect(err).not.toBeNull();
    expect(err!.message).toContain('cast_shadow');
    expect(err!.message).toContain('0-3');
    expect(err!.message).toContain('SHADOWS_ONLY');
  });

  it('rejects NaN with format code', () => {
    const labels = { 0: 'A', 1: 'B' };
    const err = v.enumInt('mode', 0, 1, labels)('mode', 'abc', 1);
    expect(err!.code).toBe('INVALID_MODE_FORMAT');
  });
});

describe('v.boolean', () => {
  it('accepts true/false', () => {
    expect(v.boolean('disabled')('disabled', 'true', 1)).toBeNull();
    expect(v.boolean('disabled')('disabled', 'false', 1)).toBeNull();
  });

  it('rejects everything else', () => {
    const err = v.boolean('disabled')('disabled', 'yes', 1);
    expect(err!.message).toContain('disabled');
    expect(err!.message).toContain('boolean');
  });
});

describe('v.string', () => {
  it('accepts non-empty', () => {
    expect(v.string('audio_bus_name')('audio_bus_name', 'master', 1)).toBeNull();
  });

  it('rejects whitespace-only', () => {
    expect(v.string('audio_bus_name')('audio_bus_name', '   ', 1)).not.toBeNull();
  });
});

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

  it('vector2i with requireNonNegative rejects negatives', () => {
    const err = v.vector2i('grid', true)('grid', 'Vector2i(-1, 0)', 1);
    expect(err!.code).toBe('INVALID_GRID_VALUE');
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

describe('column offset on every code path', () => {
  // Every per-property validator returns `column: key.length + 3`.
  // This matches the per-node tests' implicit expectation when they
  // compare diagnostics shape. Pin it across one representative path.
  it('puts the column at the value position (key.length + 3)', () => {
    const err = v.float('fov')('fov', 'oops', 1);
    expect(err!.column).toBe('fov'.length + 3);
  });
});

describe('float-tuple validators accept the renderer float grammar (#190 drift fix)', () => {
  // The canonical FLOAT_PATTERN_SOURCE (parser/vectors.ts) — the grammar the
  // renderer parses — accepts leading-dot (.5), trailing-dot (5.), an explicit
  // plus sign (+5) and scientific notation. The linter must not be STRICTER
  // than the renderer, so these must all lint clean.
  it('v.vector2 accepts .5 / 5. / +5 / scientific', () => {
    expect(v.vector2('offset')('offset', 'Vector2(.5, 5.)', 1)).toBeNull();
    expect(v.vector2('offset')('offset', 'Vector2(+1, -2.5e-2)', 1)).toBeNull();
  });

  it('v.vector3 accepts .5 / 5. / +5 / scientific', () => {
    expect(v.vector3('position')('position', 'Vector3(.5, 5., +5)', 1)).toBeNull();
    expect(v.vector3('position')('position', 'Vector3(1e3, -2.5e-2, +0)', 1)).toBeNull();
  });

  it('v.rect2 accepts the lenient grammar', () => {
    expect(v.rect2('region')('region', 'Rect2(.5, 5., +1, 2)', 1)).toBeNull();
  });

  it('v.transform3d accepts the lenient grammar', () => {
    expect(
      v.transform3d('t')('t', 'Transform3D(1., .5, +0, 0, 1, 0, 0, 0, 1, 0, 0, 0)', 1)
    ).toBeNull();
  });

  it('v.color accepts the lenient grammar', () => {
    expect(v.color('albedo_color')('albedo_color', 'Color(.5, 1., +0, 1)', 1)).toBeNull();
  });

  it('v.aabb accepts the lenient grammar', () => {
    expect(v.aabb('aabb')('aabb', 'AABB(.5, 5., +1, 1, 1, 1)', 1)).toBeNull();
  });

  it('v.quaternion accepts the lenient grammar', () => {
    expect(v.quaternion('q')('q', 'Quaternion(.5, 5., +0, 1)', 1)).toBeNull();
  });

  it('v.transform2d accepts the lenient grammar', () => {
    expect(v.transform2d('t')('t', 'Transform2D(1., .5, +0, 1, 0, 0)', 1)).toBeNull();
  });

  it('v.basis accepts the lenient grammar', () => {
    expect(v.basis('b')('b', 'Basis(1., .5, +0, 0, 1, 0, 0, 0, 1)', 1)).toBeNull();
  });

  it('still rejects non-numeric and wrong-arity tuples', () => {
    expect(v.vector3('position')('position', 'Vector3(a, b, c)', 1)).not.toBeNull();
    expect(v.vector3('position')('position', 'Vector3(1, 2)', 1)).not.toBeNull();
    expect(v.color('c')('c', 'Color(1, 1, 1)', 1)).not.toBeNull();
  });

  describe('v.packedVector2Array', () => {
    const check = (value: string) => v.packedVector2Array('polygon')('polygon', value, 1);

    it('accepts coordinate pairs', () => {
      expect(check('PackedVector2Array(0, -1, 0, 0, 2, -1)')).toBeNull();
    });

    it('accepts an EMPTY array, which is how Godot serialises one', () => {
      expect(check('PackedVector2Array()')).toBeNull();
      expect(check('PackedVector2Array(  )')).toBeNull();
    });

    it('accepts the numeric forms the corpus actually writes', () => {
      // Scientific notation appears verbatim in the vendored soft-body scenes.
      expect(check('PackedVector2Array(4.37114e-08, -1.5, +0.5, .25)')).toBeNull();
    });

    it('rejects an ODD count as a value error, not a format error', () => {
      // A truncated final vertex parses fine as a grammar but is not a polygon.
      const err = check('PackedVector2Array(0, -1, 0)');
      expect(err).not.toBeNull();
      expect(err!.code).toBe('INVALID_POLYGON_VALUE');
      expect(err!.message).toContain('pairs');
    });

    it('rejects a non-numeric entry as a format error', () => {
      const err = check('PackedVector2Array(0, nope, 1, 2)');
      expect(err).not.toBeNull();
      expect(err!.code).toBe('INVALID_POLYGON_FORMAT');
    });

    it('rejects the wrong wrapper', () => {
      expect(check('PackedVector3Array(0, 0, 0)')).not.toBeNull();
      expect(check('[0, 0, 1, 1]')).not.toBeNull();
    });

    it('rejects a trailing comma rather than reading it as an empty coordinate', () => {
      expect(check('PackedVector2Array(0, 1,)')).not.toBeNull();
    });
  });
});
