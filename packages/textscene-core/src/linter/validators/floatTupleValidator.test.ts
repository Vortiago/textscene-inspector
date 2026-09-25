/**
 * What a float-tuple slot says about the `i`-suffixed spelling it converts.
 * `Vector2i(1.5, 2)` narrows through `_parse_construct<int32_t>`
 * (`variant_parser.cpp:721-723`) to `(1, 2)` before the widening into the
 * float slot, the same truncation `v.vector2i` warns about.
 */

import { describe, expect, it } from 'vitest';
import { v } from './v.js';
import '../index.js';
import { node, scene, expectDiagnostic, expectNoDiagnostic } from '../testing/testkit';

describe('floatTupleValidator on the converted integer spelling', () => {
  it('warns that a fractional component is truncated', () => {
    const diagnostic = v.vector2('position')('position', 'Vector2i(1.5, 2)', 1);
    expect(diagnostic?.severity).toBe('warning');
    expect(diagnostic?.message).toContain('drops the fractional part of "1.5"');
  });

  it('says nothing for a whole-valued integer spelling or a float spelling', () => {
    expect(v.vector2('position')('position', 'Vector2i(1, 2)', 1)).toBeNull();
    expect(v.vector2('position')('position', 'Vector2(1.5, 2)', 1)).toBeNull();
    expect(v.vector2('position')('position', 'Vector2i(2e1, 2)', 1)).toBeNull();
  });

  it('keeps the unstorable component at the error tier', () => {
    expect(v.vector2('position')('position', 'Vector2i(inf, 2)', 1)?.severity).toBe('error');
  });

  it('boundedVector3 warns the same way after its bounds', () => {
    const bounded = v.boundedVector3('scale', { min: 0, hinted: 'node_3d.cpp:1' });
    expect(bounded('scale', 'Vector3i(1.5, 1, 1)', 1)?.severity).toBe('warning');
    expect(bounded('scale', 'Vector3i(1.5, 1, 1)', 1)?.message).toContain('drops the fractional part');
    expect(bounded('scale', 'Vector3i(-1.5, 1, 1)', 1)?.message).toContain('must be');
  });
});

describe('through the linter', () => {
  it('Node2D.position = Vector2i(1.5, 2) draws the truncation warning', () => {
    const content = scene(node('Node2D', { position: 'Vector2i(1.5, 2)' }));
    const diagnostic = expectDiagnostic(content, { prop: 'position', severity: 'warning' });
    expect(diagnostic.message).toContain('drops the fractional part');
    expectNoDiagnostic(scene(node('Node2D', { position: 'Vector2i(1, 2)' })), { prop: 'position' });
  });
});
