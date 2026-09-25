/**
 * `setting_count` on the eight classes that declare it: one int32 reading, each class's own setter
 * guard cited, and every declarer giving the same verdict on the same literal, which no other guard
 * compares across siblings.
 */
import { describe, expect, it } from 'vitest';
import { validatorRegistry, type PropertyValidator } from '../../../../linter/ValidatorRegistry.js';
import { settingCount, type SettingCountSetter } from './settingCount.js';
import '../aimmodifier3d/linterParser.js';
import '../bonetwistdisperser3d/linterParser.js';
import '../converttransformmodifier3d/linterParser.js';
import '../copytransformmodifier3d/linterParser.js';
import '../iterateik3d/linterParser.js';
import '../splineik3d/linterParser.js';
import '../springbonesimulator3d/linterParser.js';
import '../twoboneik3d/linterParser.js';

/** Each class that declares `setting_count`, and the class whose `set_setting_count` it reaches. */
const DECLARERS: ReadonlyArray<readonly [string, SettingCountSetter]> = [
  ['AimModifier3D', 'BoneConstraint3D'],
  ['ConvertTransformModifier3D', 'BoneConstraint3D'],
  ['CopyTransformModifier3D', 'BoneConstraint3D'],
  ['IterateIK3D', 'IKModifier3D'],
  ['SplineIK3D', 'IKModifier3D'],
  ['TwoBoneIK3D', 'IKModifier3D'],
  ['SpringBoneSimulator3D', 'SpringBoneSimulator3D'],
  ['BoneTwistDisperser3D', 'BoneTwistDisperser3D'],
];

/**
 * Literals that reach every arm: in range, the guard, int32 wrap, unstorable, truncated,
 * converted and unreadable.
 */
const PROBES = [
  '0',
  '3',
  '1e3',
  '2147483647',
  '-1',
  '-2147483648',
  '2147483648',
  '-2147483649',
  '4294967296',
  '9223372036854775807',
  'inf',
  'nan',
  '3.7',
  '-0.5',
  'true',
  '"x"',
] as const;

function severityOf(validator: PropertyValidator, literal: string): string {
  return validator('setting_count', literal, 1)?.severity ?? 'none';
}

describe('settingCount', () => {
  const validator = settingCount('BoneConstraint3D');

  it('accepts a count from 0 up to INT32_MAX', () => {
    for (const literal of ['0', '3', '1e3', '2147483647']) {
      expect(severityOf(validator, literal), literal).toBe('none');
    }
  });

  it('refuses a negative count, as ERR_FAIL_COND(p_count < 0) does', () => {
    expect(severityOf(validator, '-1')).toBe('error');
    expect(severityOf(validator, '-2147483648')).toBe('error');
  });

  it('refuses 2147483648, which the int32 slot wraps to a negative count', () => {
    const result = validator('setting_count', '2147483648', 1);
    expect(result?.severity).toBe('error');
    expect(result?.message).toContain('-2147483648');
  });

  it('refuses a literal no int32 slot can hold', () => {
    for (const literal of ['-2147483649', '4294967296', '9223372036854775807', 'inf', 'nan']) {
      expect(severityOf(validator, literal), literal).toBe('error');
    }
  });

  it('warns on a literal the slot stores differently from how it is written', () => {
    for (const literal of ['3.7', '-0.5', 'true']) {
      expect(severityOf(validator, literal), literal).toBe('warning');
    }
  });

  it('refuses text that is not a number', () => {
    expect(severityOf(validator, '"x"')).toBe('error');
  });

  it.each([
    ['BoneConstraint3D', 'bone_constraint_3d.cpp:131'],
    ['BoneTwistDisperser3D', 'bone_twist_disperser_3d.cpp:650'],
    ['IKModifier3D', 'ik_modifier_3d.h:98'],
    ['SpringBoneSimulator3D', 'spring_bone_simulator_3d.cpp:841'],
  ] as const)('cites the %s guard as enforced, on an int32 slot', (setter, cite) => {
    const tagged = settingCount(setter);
    expect(tagged.grounding).toEqual({ kind: 'enforced', cite });
    expect(tagged.intSlot?.width).toBe('int32');
  });
});

describe('setting_count across its eight declarers', () => {
  it.each(DECLARERS)('%s owns the key and cites its own setter guard', (nodeType, setter) => {
    expect(validatorRegistry.getOwnKeys(nodeType)).toContain('setting_count');
    const declared = validatorRegistry.declarationFor(nodeType, 'setting_count')!;
    expect(declared.grounding).toEqual(settingCount(setter).grounding);
    expect(declared.intSlot).toEqual(settingCount(setter).intSlot);
  });

  it.each(PROBES)('gives every declarer the same verdict on %s', (literal) => {
    const verdicts = DECLARERS.map(([nodeType]) => {
      const validator = validatorRegistry.findValidator(nodeType, 'setting_count')!;
      const result = validator('setting_count', literal, 1);
      return result === null ? 'none' : `${result.severity}: ${result.message}`;
    });
    expect(new Set(verdicts).size).toBe(1);
  });
});
