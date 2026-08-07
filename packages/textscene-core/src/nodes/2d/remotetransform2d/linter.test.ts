/**
 * RemoteTransform2D linter tests —
 * `RemoteTransform2D::get_configuration_warnings()` (remote_transform_2d.cpp:213-220):
 * `remote_path` absent, unresolvable, or not a Node2D.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, lint, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import './linterParser';
import './linter';

const RULE_NAME = 'remotetransform2d-invalid-remote-path';

describe('RemoteTransform2D Linter', () => {
  it('warns when remote_path is absent', () => {
    expectDiagnostic(scene(node('RemoteTransform2D')), {
      ruleName: RULE_NAME,
      severity: 'warning',
    });
  });

  it('warns when remote_path is the empty NodePath', () => {
    expectDiagnostic(
      scene(node('RemoteTransform2D', { remote_path: 'NodePath("")' })),
      { ruleName: RULE_NAME, severity: 'warning' }
    );
  });

  it('warns when remote_path names no node in this file', () => {
    expectDiagnostic(
      scene(node('RemoteTransform2D', { remote_path: 'NodePath("Ghost")' })),
      { ruleName: RULE_NAME, severity: 'warning' }
    );
  });

  it('warns when remote_path resolves to a non-Node2D node', () => {
    const diagnostic = expectDiagnostic(
      scene(
        node('Node', {}, { name: 'Root' }),
        node('Node', {}, { name: 'Target', parent: '.' }),
        node('RemoteTransform2D', { remote_path: 'NodePath("Target")' }, { parent: '.' })
      ),
      { ruleName: RULE_NAME, severity: 'warning' }
    );
    expect(diagnostic.message).toContain('Target');
    expect(diagnostic.message).toContain('Node');
  });

  it('passes when remote_path resolves to a Node2D-descended node by name', () => {
    expectNoDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Sprite2D', {}, { name: 'Target', parent: '.' }),
        node('RemoteTransform2D', { remote_path: 'NodePath("Target")' }, { parent: '.' })
      ),
      { ruleName: RULE_NAME }
    );
  });

  it('stays quiet on a relative (..) path — resolution is not attempted', () => {
    expectNoDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Sprite2D', {}, { name: 'Target', parent: '.' }),
        node('RemoteTransform2D', { remote_path: 'NodePath("../Target")' }, { parent: '.' })
      ),
      { ruleName: RULE_NAME }
    );
  });

  it('stays quiet when the name is ambiguous (two nodes share it)', () => {
    expectNoDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Sprite2D', {}, { name: 'Target', parent: '.' }),
        node('Sprite2D', {}, { name: 'Other', parent: '.' }),
        node('Node2D', {}, { name: 'Target', parent: 'Other' }),
        node('RemoteTransform2D', { remote_path: 'NodePath("Target")' }, { parent: '.' })
      ),
      { ruleName: RULE_NAME }
    );
  });

  it('lints the shipped fixture clean of this rule', () => {
    const diagnostics = lint(readFixture('unit-remote-transform-2d.tscn')).filter(
      (d) => d.ruleName === RULE_NAME
    );
    expect(diagnostics).toEqual([]);
  });
});
