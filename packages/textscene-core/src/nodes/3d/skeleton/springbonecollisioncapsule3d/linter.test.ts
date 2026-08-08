/**
 * Tests for the SpringBoneCollisionCapsule3D shape rule
 * (`springbonecollisioncapsule3d-radius-exceeds-half-height`).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import { readFixture } from '../../../../linter/testing/fixtureCheck';
// The ancestor's parent rule reaches every SpringBoneCollision3D subclass, so
// the fixture's "no diagnostics" claim is only honest with it loaded.
import '../springbonecollision3d/linter';
import './linterParser';
import './linter';

const RULE = 'springbonecollisioncapsule3d-radius-exceeds-half-height';

function reportsOf(diagnostics: ReturnType<Linter['lint']>) {
  return diagnostics.filter((d) => d.ruleName === RULE);
}

/** A capsule under a SpringBoneSimulator3D, so only this rule can speak. */
function scene(properties: string): string {
  return `[gd_scene format=3]

[node name="Sim" type="SpringBoneSimulator3D"]

[node name="Capsule" type="SpringBoneCollisionCapsule3D" parent="."]
${properties}`;
}

describe('SpringBoneCollisionCapsule3D shape rule', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  it('leaves the committed fixture with no diagnostic at all', () => {
    // The fixture's "zero errors AND zero warnings" claim on the rule side.
    // `expectFixtureClean` in linterParser.test.ts runs validators only, so it
    // cannot see a rule firing, including the ancestor's parent check, which
    // is why the fixture parents its capsule under a SpringBoneSimulator3D.
    expect(linter.lint(readFixture('unit-spring-bone-collision-capsule-3d.tscn'))).toEqual([]);
  });

  it('accepts a radius at exactly half the height', () => {
    // `if (radius > height * 0.5)` is strict on both setters
    // (spring_bone_collision_capsule_3d.cpp:37, :51), so equality is untouched.
    expect(reportsOf(linter.lint(scene('radius = 0.5\nheight = 1.0\n')))).toEqual([]);
  });

  it('accepts a radius comfortably under half the height', () => {
    expect(reportsOf(linter.lint(scene('radius = 0.15\nheight = 1.0\n')))).toEqual([]);
  });

  it('errors when the radius exceeds half the height, quoting both values as written', () => {
    const reports = reportsOf(linter.lint(scene('radius = 0.6\nheight = 0.8\n')));
    expect(reports).toHaveLength(1);
    // ADR-0032 error tier: `set_height` rewrites `radius` to half the height
    // rather than keeping what was authored.
    expect(reports[0]!.severity).toBe('error');
    expect(reports[0]!.message).toContain('0.6');
    expect(reports[0]!.message).toContain('0.8');
    expect(reports[0]!.nodeName).toBe('Capsule');
  });

  it('stays quiet when only radius is written, since the written value survives', () => {
    // `set_radius` moves `height`, never its own argument
    // (spring_bone_collision_capsule_3d.cpp:36-38), so a file naming radius
    // alone loads with that radius intact. Warning here would fire on a scene
    // whose every written value Godot honours.
    expect(reportsOf(linter.lint(scene('radius = 4.0\n')))).toEqual([]);
  });

  it('stays quiet when only height is written', () => {
    // Mirror case: `set_height` moves `radius`, never its own argument (:50-52).
    expect(reportsOf(linter.lint(scene('height = 0.02\n')))).toEqual([]);
  });

  it('stays quiet on a capsule with no properties at all', () => {
    expect(reportsOf(linter.lint(scene('')))).toEqual([]);
  });

  it('stays quiet on nan, which trips no comparison', () => {
    expect(reportsOf(linter.lint(scene('radius = nan\nheight = 1.0\n')))).toEqual([]);
  });

  it('warns on an infinite radius, which exceeds half of any finite height', () => {
    // `inf` is a legal literal Godot writes and reloads
    // (variant_parser.cpp:150-155), and it is a real value on the number line.
    const warnings = reportsOf(linter.lint(scene('radius = inf\nheight = 1.0\n')));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.message).toContain('inf');
  });

  it('ignores an unreadable value rather than guessing at it', () => {
    expect(reportsOf(linter.lint(scene('radius = 0.6\nheight = "tall"\n')))).toEqual([]);
  });

  it('does not fire on another SpringBoneCollision3D carrying the same keys', () => {
    // The base class has neither property; the assertion is that the rule is
    // scoped to the capsule rather than to the collision family.
    const content = `[gd_scene format=3]

[node name="Sim" type="SpringBoneSimulator3D"]

[node name="Collision" type="SpringBoneCollision3D" parent="."]
radius = 4.0
height = 0.1
`;
    expect(reportsOf(linter.lint(content))).toEqual([]);
  });
});
