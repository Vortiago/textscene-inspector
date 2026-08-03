/**
 * Edge cases for the StyleBox override funnel: ref parsing + SubResource lookup.
 * The StyleBoxFlat→CSS mapping itself is covered in styleBoxToCss.test.ts —
 * here we pin what resolves (`resolveStyleBox` → CSS) and what does not
 * (`null`), plus the `resolveStyleBoxCss` collapse every miss keeps.
 */
import { describe, expect, it } from 'vitest';
import { resolveStyleBox, resolveStyleBoxCss } from './resolveStyleBox';
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

  it('returns an explicit transparent fill for StyleBoxEmpty (a box that paints nothing)', () => {
    expect(resolveStyleBoxCss('SubResource("StyleBoxEmpty_x")', resources)).toEqual({
      backgroundColor: 'transparent',
    });
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

/**
 * `resolveStyleBox` is the reader consumers pick their default with: `null`
 * means NO box resolved (so the Control keeps its own default chrome), while a
 * resolved box returns its CSS — even when that CSS paints nothing. Consumers
 * asking "is this object empty?" cannot tell those two apart.
 */
describe('resolveStyleBox — resolved or not', () => {
  it('is null for every leg that resolves no box', () => {
    expect(resolveStyleBox(undefined, resources)).toBeNull();
    expect(resolveStyleBox('not-a-ref', resources)).toBeNull();
    expect(resolveStyleBox('ExtResource("1_abc")', resources)).toBeNull();
    expect(resolveStyleBox('SubResource("StyleBoxFlat_nope")', resources)).toBeNull();
    expect(resolveStyleBox('SubResource("StyleBoxFlat_p4nl")', [])).toBeNull();
  });

  it('is null for a sub-resource that is not a StyleBox this slice decodes', () => {
    // A StyleBoxTexture is a box we cannot paint at all — treated as unresolved
    // so the Control keeps visible default chrome rather than vanishing.
    expect(resolveStyleBox('SubResource("StandardMaterial3D_m")', resources)).toBeNull();
    expect(
      resolveStyleBox('SubResource("SB_tex")', [
        { id: 'SB_tex', type: 'StyleBoxTexture', data: {} },
      ])
    ).toBeNull();
  });

  it('returns the CSS of a box that resolves, including one that paints nothing', () => {
    expect(resolveStyleBox('SubResource("StyleBoxFlat_p4nl")', resources)?.backgroundColor).toBe(
      'rgba(255, 0, 0, 1)'
    );
    expect(resolveStyleBox('SubResource("StyleBoxEmpty_x")', resources)).toEqual({
      backgroundColor: 'transparent',
    });
  });
});
