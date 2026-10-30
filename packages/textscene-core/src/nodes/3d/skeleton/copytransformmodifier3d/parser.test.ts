import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseCopyTransformModifier3D } from './parser';

const COPY_ROTATION = 2;
/** The most settings the parser builds, which is where a crafted count stops. */
const SETTING_CEILING = 10_000;

function parse(properties: Record<string, string>) {
  return parseCopyTransformModifier3D(heading('CopyTransformModifier3D', { name: 'M' }), properties);
}

describe('parseCopyTransformModifier3D', () => {
  it('has no setting until setting_count adds one', () => {
    expect(parse({}).settings).toEqual([]);
  });

  it("adds a setting at Godot's defaults (`bone_constraint_3d.h:44-57`, `copy_transform_modifier_3d.h:57-70`)", () => {
    const [setting] = parse({ setting_count: '1' }).settings;

    expect(setting).toEqual({
      amount: 1,
      applyBoneName: '',
      applyBone: -1,
      referenceType: 0,
      referenceBoneName: '',
      referenceBone: -1,
      referenceNode: '',
      copyFlags: 7,
      axisFlags: 7,
      invertFlags: 0,
      relative: true,
      additive: false,
    });
  });

  it('reads the leaves of the base and of the class', () => {
    const [setting] = parse({
      setting_count: '1',
      'settings/0/amount': '0.5',
      'settings/0/apply_bone_name': '"b4"',
      'settings/0/reference_bone_name': '"b2"',
      'settings/0/copy': String(COPY_ROTATION),
      'settings/0/axes': '4',
      'settings/0/invert': '2',
      'settings/0/relative': 'false',
      'settings/0/additive': 'true',
    }).settings;

    expect(setting).toMatchObject({
      amount: 0.5,
      applyBoneName: 'b4',
      referenceBoneName: 'b2',
      copyFlags: COPY_ROTATION,
      axisFlags: 4,
      invertFlags: 2,
      relative: false,
      additive: true,
    });
  });

  it('reads a reference node as the path its NodePath stores', () => {
    const [setting] = parse({
      setting_count: '1',
      'settings/0/reference_type': '1',
      'settings/0/reference_node': 'NodePath("../Target")',
    }).settings;

    expect(setting).toMatchObject({ referenceType: 1, referenceNode: '../Target' });
  });

  it('refuses a setting write before setting_count has made the slot (`ERR_FAIL_INDEX_V`)', () => {
    const { settings } = parse({ 'settings/0/amount': '0.5', setting_count: '1' });

    expect(settings[0]!.amount).toBe(1);
  });

  it('refuses a setting past the count (edge case)', () => {
    expect(parse({ setting_count: '1', 'settings/3/amount': '0.5' }).settings).toHaveLength(1);
  });

  it('refuses a negative setting_count (edge case)', () => {
    expect(parse({ setting_count: '-1' }).settings).toEqual([]);
  });

  it('refuses a setting_count past the ceiling, which a crafted file would use to exhaust memory (edge case)', () => {
    expect(parse({ setting_count: '50000000' }).settings).toEqual([]);
    expect(parse({ setting_count: String(SETTING_CEILING) }).settings).toHaveLength(SETTING_CEILING);
  });

  it('keeps the default of a leaf whose value is malformed (edge case)', () => {
    const [setting] = parse({
      setting_count: '1',
      'settings/0/amount': 'lots',
      'settings/0/copy': 'all',
    }).settings;

    expect(setting).toMatchObject({ amount: 1, copyFlags: 7 });
  });
});
