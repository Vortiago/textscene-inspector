/**
 * Edge cases for resolveStyleBoxCss: ref parsing + SubResource lookup.
 * The StyleBoxFlat→CSS mapping itself is covered in styleBoxToCss.test.ts —
 * here we pin the resolution funnel (every miss collapses to `{}`).
 */
import { describe, expect, it } from 'vitest';
import { resolveStyleBoxCss } from './resolveStyleBox';
import type { TscnInternalResource } from '../../parser/types';

const resources: TscnInternalResource[] = [
  {
    id: 'StyleBoxFlat_p4nl',
    type: 'StyleBoxFlat',
    data: { bg_color: 'Color(1, 0, 0, 1)', corner_radius_top_left: '6' },
  },
  { id: 'StyleBoxEmpty_x', type: 'StyleBoxEmpty', data: {} },
  { id: 'StandardMaterial3D_m', type: 'StandardMaterial3D', data: {} },
];

describe('resolveStyleBoxCss', () => {
  it('returns {} for a missing (undefined) ref', () => {
    expect(resolveStyleBoxCss(undefined, resources)).toEqual({});
  });

  it('returns {} for a ref that is not a resource reference at all', () => {
    expect(resolveStyleBoxCss('not-a-ref', resources)).toEqual({});
  });

  it('returns {} for an ExtResource ref (only SubResources resolve)', () => {
    expect(resolveStyleBoxCss('ExtResource("1_abc")', resources)).toEqual({});
  });

  it('returns {} for an unknown SubResource id', () => {
    expect(resolveStyleBoxCss('SubResource("StyleBoxFlat_nope")', resources)).toEqual({});
  });

  it('returns {} when the id resolves to a non-StyleBox SubResource', () => {
    expect(resolveStyleBoxCss('SubResource("StandardMaterial3D_m")', resources)).toEqual({});
  });

  it('returns {} for StyleBoxEmpty (transparent box)', () => {
    expect(resolveStyleBoxCss('SubResource("StyleBoxEmpty_x")', resources)).toEqual({});
  });

  it('passes a valid StyleBoxFlat through to CSS', () => {
    const css = resolveStyleBoxCss('SubResource("StyleBoxFlat_p4nl")', resources);
    expect(css.backgroundColor).toBe('rgba(255, 0, 0, 1)');
    expect(css.borderRadius).toBe('6px 0px 0px 0px');
  });

  it('returns {} when the resource list is empty', () => {
    expect(resolveStyleBoxCss('SubResource("StyleBoxFlat_p4nl")', [])).toEqual({});
  });
});
