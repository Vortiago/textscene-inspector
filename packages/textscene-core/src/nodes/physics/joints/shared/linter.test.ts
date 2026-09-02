/**
 * The joint dead-configuration rule, asserted once for the whole family.
 *
 * Five agents building joint slices in one wave each found Godot's
 * `Joint2D::get_configuration_warnings` and each correctly declined to
 * implement it, because it belongs to the base rather than to any leaf. This is
 * that rule: one registration for both dimensions, reaching every subclass
 * through `applicableNodeTypeMatcher`.
 */

import { describe, expect, it } from 'vitest';
import { expectClean, expectDiagnostic, expectNoDiagnostic, node, scene } from '../../../../linter/testing/testkit.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { jointValidationRule } from './linter.js';
import '../../../../linter/index.js';

/** A joint wired to two distinct bodies trips nothing. */
const CONNECTED = { node_a: 'NodePath("../BodyA")', node_b: 'NodePath("../BodyB")' };

const LEAVES_2D = ['PinJoint2D', 'GrooveJoint2D', 'DampedSpringJoint2D'] as const;
const LEAVES_3D = ['PinJoint3D', 'HingeJoint3D'] as const;

describe('joint dead-configuration rule', () => {
  it('registers ONE rule for the whole family, not one per joint type', () => {
    // Eight leaves and two dimensions share it; the dimension only changes a
    // noun in the message, which `check` derives from the node's own type.
    expect(ruleRegistry.getRules().find((r) => r.meta.name === 'valid-joint')).toBe(
      jointValidationRule
    );
  });

  it.each([...LEAVES_2D, ...LEAVES_3D])('reaches the %s leaf through the matcher', (type) => {
    expectDiagnostic(scene(node(type, {})), {
      ruleName: 'joint-not-connected',
      severity: 'warning',
      nodeType: type,
    });
  });

  it.each([...LEAVES_2D, ...LEAVES_3D])('stays quiet on a %s wired to two bodies', (type) => {
    expectClean(scene(node(type, CONNECTED)));
  });

  // `_update_joint` derives each body from `get_node_or_null` (joint_2d.cpp:70-74),
  // so the "not connected" arm cannot be answered from the presence of the path
  // text alone. These two pin both directions against a real tree.
  it('stays quiet when both ends resolve to real sibling bodies', () => {
    // Scoped to this rule: the bare bodies correctly trip
    // `collisionobject2d-needs-collision-shape`, which is not what this asserts.
    expectNoDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('StaticBody2D', {}, { name: 'BodyA', parent: '.' }),
        node('StaticBody2D', {}, { name: 'BodyB', parent: '.' }),
        node('PinJoint2D', CONNECTED, { name: 'Joint', parent: '.' })
      ),
      { ruleName: 'joint-not-connected' }
    );
  });

  it('warns when an end names a node that does not resolve', () => {
    expectDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('StaticBody2D', {}, { name: 'BodyA', parent: '.' }),
        node(
          'PinJoint2D',
          { node_a: 'NodePath("../BodyA")', node_b: 'NodePath("../NoSuchBody")' },
          { name: 'Joint', parent: '.' }
        )
      ),
      { ruleName: 'joint-not-connected', severity: 'warning' }
    );
  });

  it('names which end is unset rather than saying only "not connected"', () => {
    const onlyA = expectDiagnostic(scene(node('PinJoint2D', { node_a: 'NodePath("../BodyA")' })), {
      ruleName: 'joint-not-connected',
    });
    expect(onlyA.message).toContain("'node_b' is unset");

    const neither = expectDiagnostic(scene(node('PinJoint2D', {})), {
      ruleName: 'joint-not-connected',
    });
    expect(neither.message).toContain("'node_a' and 'node_b' are unset");
  });

  it('treats an empty NodePath as unset, which is how Godot serialises "none"', () => {
    expectDiagnostic(scene(node('PinJoint2D', { node_a: 'NodePath("")', node_b: 'NodePath("../B")' })), {
      ruleName: 'joint-not-connected',
    });
  });

  it('holds each dimension to its own threshold, because Godot does', () => {
    // 2D warns on `!body_a || !body_b` (joint_2d.cpp:84), so ONE loose end is
    // enough. 3D warns on `!body_a && !body_b` (joint_3d.cpp:82), so a joint
    // anchored to the world by a single body is a configuration 4.6.3 accepts in
    // silence. Reading the two as one rule warned about scenes Godot does not.
    const oneEnd = { node_b: 'NodePath("../BodyB")' };
    expectDiagnostic(scene(node('PinJoint2D', oneEnd)), { ruleName: 'joint-not-connected' });
    expectNoDiagnostic(scene(node('PinJoint3D', oneEnd)), { ruleName: 'joint-not-connected' });

    // With BOTH ends unset the dimensions agree again.
    expectDiagnostic(scene(node('PinJoint3D', {})), { ruleName: 'joint-not-connected' });
  });

  it('says "two" in 2D and "any" in 3D, matching each engine string', () => {
    const twoD = expectDiagnostic(scene(node('PinJoint2D', {})), { ruleName: 'joint-not-connected' });
    expect(twoD.message).toContain('not connected to two PhysicsBody2Ds');

    const threeD = expectDiagnostic(scene(node('PinJoint3D', {})), { ruleName: 'joint-not-connected' });
    expect(threeD.message).toContain('not connected to any PhysicsBody3Ds');
  });

  it('flags both ends pointing at the same body', () => {
    const d = expectDiagnostic(
      scene(node('HingeJoint3D', { node_a: 'NodePath("../Body")', node_b: 'NodePath("../Body")' })),
      { ruleName: 'joint-same-body', severity: 'warning' }
    );
    expect(d.message).toContain('../Body');
  });

  // `_update_joint` compares the resolved POINTERS (`body_a == body_b`,
  // joint_2d.cpp:86), so one body reached by two spellings is still one body.
  it('flags one body reached by two different paths', () => {
    const content = [
      '[gd_scene format=3]',
      '',
      '[node name="Root" type="Node2D"]',
      '',
      '[node name="Body" type="StaticBody2D" parent="."]',
      'unique_name_in_owner = true',
      '',
      '[node name="Joint" type="PinJoint2D" parent="."]',
      'node_a = NodePath("../Body")',
      'node_b = NodePath("%Body")',
      '',
    ].join('\n');
    const d = expectDiagnostic(content, { ruleName: 'joint-same-body', severity: 'warning' });
    expect(d.message).toContain('Body');
  });

  it('does not also report not-connected when both ends name one body', () => {
    // The two cases are exclusive in Godot's own chain; reporting both would
    // double up on one defect.
    expectNoDiagnostic(
      scene(node('PinJoint2D', { node_a: 'NodePath("../B")', node_b: 'NodePath("../B")' })),
      { ruleName: 'joint-not-connected' }
    );
  });

  it('leaves non-joints alone, and keeps the dimensions apart', () => {
    expectNoDiagnostic(scene(node('StaticBody2D', {})), { ruleName: 'joint-not-connected' });
    // The matcher takes both dimensions; `check` picks the noun per node.
    const matches = jointValidationRule.meta.applicableNodeTypeMatcher!;
    expect(matches('PinJoint3D')).toBe(true);
    expect(matches('PinJoint2D')).toBe(true);
    expect(matches('StaticBody2D')).toBe(false);
  });

  it('declares exactly the two names it can emit, and no per-dimension variants', () => {
    // Godot's other three warnings ("Node A must be a PhysicsBody2D", …) resolve
    // the path and check the class. A NodePath can cross into an instanced
    // sub-scene, so answering that statically false-positives on real scenes.
    const emitted = jointValidationRule.meta.emits?.map((e) => e.ruleName) ?? [];
    expect(emitted).toEqual(['joint-not-connected', 'joint-same-body']);
  });
});
