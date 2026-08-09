/**
 * The tuple and reference combinators: vectors, Rect2, Transform3D, resource
 * references, NodePath and Color — their shape checks, and the lenient float
 * grammar every one of them must accept.
 *
 * The scalar combinators are `v.test.ts`; the packed arrays and the string
 * grammars are `v.packedArrays.test.ts`.
 */

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

  it('vector2i without a min is format-only, so it needs no citation', () => {
    expect(v.vector2i('grid').formatOnly).toBe(true);
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
});
