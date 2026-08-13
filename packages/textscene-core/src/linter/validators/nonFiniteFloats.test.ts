/**
 * `inf` / `-inf` / `inf_neg` / `nan` are legal TSCN float literals.
 *
 * Godot's parser reads all four (`core/variant/variant_parser.cpp:150-155` for
 * the string form, `:701-706` for the token form) and its serializer writes
 * them back, so a scene carrying one is a scene Godot produced. `parseFloat`
 * returns NaN for every one, which used to make the shared numeric validator
 * report a FORMAT error on all of them everywhere.
 *
 * That was right for exactly five properties and wrong for every other float in
 * the repo. These tests pin both halves of the split.
 */

import { describe, expect, it } from 'vitest';
import { parseGodotFloat, TSCN_FLOAT_PATTERN_SOURCE } from './commonValidators.js';
import { makeFloatTupleRegex } from './floatTupleValidator.js';
import { FLOAT_PATTERN_SOURCE } from '../../parser/vectors.js';
import { v } from './v.js';

const NON_FINITE = ['inf', '-inf', 'inf_neg', 'nan'];

describe('parseGodotFloat', () => {
  it.each([
    ['inf', Infinity],
    ['-inf', -Infinity],
    ['inf_neg', -Infinity],
  ])('reads %s as %s', (text, expected) => {
    expect(parseGodotFloat(text)).toBe(expected);
  });

  it('reads nan as NaN rather than as a miss', () => {
    // The distinction the null sentinel exists for: `nan` is a value, not a
    // parse failure, and collapsing the two would reject it.
    expect(parseGodotFloat('nan')).toBeNaN();
    expect(parseGodotFloat('nan')).not.toBeNull();
  });

  it('still reads ordinary floats', () => {
    expect(parseGodotFloat('1.5')).toBe(1.5);
    expect(parseGodotFloat('-0.25')).toBe(-0.25);
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseGodotFloat('  inf  ')).toBe(Infinity);
  });

  it.each(['', 'abc', 'Infinity', '-Infinity', 'NaN', 'inf inf'])(
    'returns null for %o',
    (text) => {
      // `Infinity`/`NaN` are JavaScript spellings; Godot's tokenizer matches
      // only the four above, so they stay format errors.
      expect(parseGodotFloat(text)).toBeNull();
    }
  );

  it('still reads an overflowing literal as infinity, as Godot does', () => {
    expect(parseGodotFloat('1e999')).toBe(Infinity);
  });
});

describe('an ordinary float property', () => {
  const unbounded = v.float('some_float');

  it.each(NON_FINITE)('accepts %s, which Godot stores unaltered', (value) => {
    expect(unbounded('some_float', value, 1)).toBeNull();
  });

  it('still rejects text that is not a float at all', () => {
    expect(unbounded('some_float', 'wide', 1)?.code).toBe('INVALID_SOME_FLOAT_FORMAT');
  });

  it('reports inf against a hinted ceiling as a range problem, not a format one', () => {
    const bounded = v.float('ratio', { min: 0, max: 1, hinted: 'x.cpp:1' });
    const diagnostic = bounded('ratio', 'inf', 1);
    expect(diagnostic?.code).toBe('INVALID_RATIO_VALUE');
    expect(diagnostic?.severity).toBe('warning');
  });

  it('reports nothing for nan against a bound, since every comparison is false', () => {
    const bounded = v.float('ratio', { min: 0, max: 1, hinted: 'x.cpp:1' });
    expect(bounded('ratio', 'nan', 1)).toBeNull();
  });
});

describe('a property whose setter guards is_finite', () => {
  const guarded = v.float('icon_scale', { finite: 'item_list.cpp:2098' });

  it.each(NON_FINITE)('rejects %s as an error', (value) => {
    const diagnostic = guarded('icon_scale', value, 1);
    expect(diagnostic?.severity).toBe('error');
    expect(diagnostic?.code).toBe('INVALID_ICON_SCALE_VALUE');
    expect(diagnostic?.message).toContain('finite');
  });

  it('accepts an ordinary value', () => {
    expect(guarded('icon_scale', '1.5', 1)).toBeNull();
  });

  it('accepts a negative value, which this setter does not refuse', () => {
    expect(guarded('icon_scale', '-2', 1)).toBeNull();
  });

  it('carries the finite guard as its grounding', () => {
    expect(guarded.grounding).toEqual({ kind: 'enforced', cite: 'item_list.cpp:2098' });
  });

  it('keeps both citations when a range bound is also present', () => {
    // The finite check and the range check are separate lines in the setter;
    // recording only one makes the other uncheckable.
    const both = v.float('radial_initial_angle', {
      min: 0,
      max: 360,
      enforced: 'texture_progress_bar.cpp:594',
      finite: 'texture_progress_bar.cpp:592',
    });
    expect(both.grounding?.cite).toBe('texture_progress_bar.cpp:592, texture_progress_bar.cpp:594');
  });

  it('keeps the bounds themselves, not just their citation', () => {
    // `hintImplementationParity` compares `bounds` against the engine's own
    // PROPERTY_HINT_RANGE numbers. A wrapper that forwarded the cite but
    // dropped the numbers took the property out of that comparison silently,
    // and it counted as an unimplemented end while being fully implemented.
    const both = v.float('radial_initial_angle', {
      min: 0,
      max: 360,
      enforced: 'texture_progress_bar.cpp:594',
      finite: 'texture_progress_bar.cpp:592',
    });
    expect(both.bounds).toEqual({ min: 0, max: 360 });
    expect(both.tiers).toEqual({ min: 'error', max: 'error' });
  });

  it('applies to nonNegativeFloat too, where zoom_step needs it', () => {
    const step = v.nonNegativeFloat('zoom_step', {
      enforced: { min: 'graph_edit.cpp:2465' },
      finite: 'graph_edit.cpp:2466',
    });
    expect(step('zoom_step', 'inf', 1)?.severity).toBe('error');
    expect(step('zoom_step', '1.2', 1)).toBeNull();
  });
});

describe('a COMPOSITE literal with a non-finite component', () => {
  it.each(NON_FINITE)('v.vector3 accepts a %s component', (value) => {
    // `variant_parser.cpp:577-587` — a constructor argument that is not a
    // number is run through `stor_fix`, which reads exactly these four; and
    // the writer puts every Vector3 component through `rtos_fix` (:2056).
    expect(v.vector3('offset')('offset', `Vector3(0, ${value}, 0)`, 1)).toBeNull();
  });

  // One case per composite Godot serialises through `rtos_fix`, since each is a
  // separate arity/type registration even though they share one component
  // grammar. `inf_neg` is the spelling the .tscn writer actually emits for
  // negative infinity: `use_compat` is true for a text scene
  // (`resource_format_text.cpp:1770`) and `rtos_fix` writes `inf_neg` under it
  // (`variant_parser.cpp:1989-1991`).
  it.each([
    ['vector2', 'position', 'Vector2(inf_neg, 0)'],
    ['color', 'modulate', 'Color(inf, 0, 0, 1)'],
    ['rect2', 'region_rect', 'Rect2(0, 0, inf, inf)'],
    ['quaternion', 'quaternion', 'Quaternion(0, 0, 0, nan)'],
    ['aabb', 'custom_aabb', 'AABB(0, 0, 0, inf, inf, inf)'],
    ['basis', 'basis', 'Basis(inf, 0, 0, 0, 1, 0, 0, 0, 1)'],
    ['transform2d', 'transform', 'Transform2D(1, 0, 0, 1, inf_neg, 0)'],
    ['transform3d', 'transform', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -inf, 0)'],
  ] as const)('v.%s accepts one', (kind, name, literal) => {
    expect(v[kind](name)(name, literal, 1)).toBeNull();
  });

  it('still rejects a component that is neither a number nor one of the four', () => {
    expect(v.vector3('offset')('offset', 'Vector3(0, infinity, 0)', 1)?.code).toBe(
      'INVALID_OFFSET_FORMAT'
    );
    expect(v.vector3('offset')('offset', 'Vector3(0, 1.2.3, 0)', 1)?.code).toBe(
      'INVALID_OFFSET_FORMAT'
    );
  });

  it.each(NON_FINITE)('still rejects %s in an INTEGER composite', (value) => {
    // Vector2i serialises through `itos` (variant_parser.cpp:2044), so it has
    // no spelling for a non-finite component and Godot never writes one.
    expect(v.vector2i('size')('size', `Vector2i(${value}, 8)`, 1)?.code).toBe('INVALID_SIZE_FORMAT');
  });
});

describe('the widened component grammar and parseGodotFloat', () => {
  const component = new RegExp(`^${TSCN_FLOAT_PATTERN_SOURCE}$`);

  // The failure this guards is a hand-added alternative in one of the two: a
  // spelling the pattern lets through but the reader cannot turn into a number,
  // or the reverse. Both are derived from one table, and this is what says so.
  it.each([...NON_FINITE, '1.5', '-0.25', '1e-05', '5.', '.5', '+5'])(
    'both accept %o',
    (text) => {
      expect(component.test(text)).toBe(true);
      expect(parseGodotFloat(text)).not.toBeNull();
    }
  );

  it.each(['Infinity', '-Infinity', 'NaN', '+inf', '-nan', '-inf_neg', 'INF', 'inf inf', ''])(
    'both reject %o',
    (text) => {
      expect(component.test(text)).toBe(false);
      expect(parseGodotFloat(text)).toBeNull();
    }
  );

  it('is the renderer grammar plus the non-finite spellings, not a second copy', () => {
    expect(TSCN_FLOAT_PATTERN_SOURCE).toContain(FLOAT_PATTERN_SOURCE);
  });

  it('adds no capture group, so component groups stay 1..arity', () => {
    const match = makeFloatTupleRegex('Vector3', 3).exec('Vector3(1, inf_neg, 3)');
    expect(match).not.toBeNull();
    expect(match).toHaveLength(4);
    expect(match![2]).toBe('inf_neg');
  });
});

describe('a composite with a per-COMPONENT bound', () => {
  // gpu_particles_collision_3d.cpp:101 hints `size` "0.01,1024,0.01,or_greater".
  const bounded = v.boundedVector3('size', { min: 0.01, max: 1024, hinted: 'x.cpp:1' });

  it('reports inf against a hinted ceiling as a range problem, as the scalar path does', () => {
    const diagnostic = bounded('size', 'Vector3(inf, 1, 1)', 1);
    expect(diagnostic?.code).toBe('INVALID_SIZE_VALUE');
    expect(diagnostic?.severity).toBe('warning');
  });

  it('reports inf_neg under a floor the same way', () => {
    expect(bounded('size', 'Vector3(1, inf_neg, 1)', 1)?.code).toBe('INVALID_SIZE_VALUE');
  });

  it('reports nothing for a nan component, since every comparison is false', () => {
    expect(bounded('size', 'Vector3(nan, 1, 1)', 1)).toBeNull();
  });

  it('shows the out-of-range component as a number, never as NaN', () => {
    expect(bounded('size', 'Vector3(inf, 1, 1)', 1)?.message).toContain('Vector3(Infinity, 1, 1)');
  });
});

describe('a PACKED array element', () => {
  const points = v.packedVector2Array('polygon');

  it.each(NON_FINITE)('accepts %s, which the array writer emits too', (value) => {
    // variant_parser.cpp:2504 puts every PackedVector2Array component through
    // `rtos_fix`, exactly as the fixed-arity composites do.
    expect(points('polygon', `PackedVector2Array(0, 0, ${value}, 1)`, 1)).toBeNull();
  });

  it('still rejects an element that is not a float literal', () => {
    expect(points('polygon', 'PackedVector2Array(0, 0, wide, 1)', 1)?.code).toBe(
      'INVALID_POLYGON_FORMAT'
    );
    expect(points('polygon', 'PackedVector2Array(0, 0, , 1)', 1)?.code).toBe(
      'INVALID_POLYGON_FORMAT'
    );
  });

  it('rejects an element with trailing garbage that Number() and parseFloat disagree on', () => {
    // `Number('1abc')` is NaN but `parseFloat('1abc')` is 1: the grammar decides,
    // and Godot's tokenizer stops the number at `a` and then fails on the
    // unexpected identifier.
    expect(points('polygon', 'PackedVector2Array(0, 0, 1abc, 1)', 1)?.code).toBe(
      'INVALID_POLYGON_FORMAT'
    );
  });
});
