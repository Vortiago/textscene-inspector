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

  it('passes when remote_path resolves to a child of the RemoteTransform2D', () => {
    expectNoDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('RemoteTransform2D', {}, { name: 'Relay', parent: '.' }),
        node('Sprite2D', {}, { name: 'Target', parent: 'Relay' }),
        node(
          'RemoteTransform2D',
          { remote_path: 'NodePath("Target")' },
          { name: 'Relay2', parent: '.' }
        )
      ),
      { ruleName: RULE_NAME, prop: 'Relay/' }
    );
  });

  // `data.children.getptr(name)` is the referencing node's OWN children
  // (node.cpp:1941), so a sibling needs `../` and a bare name resolves to null.
  it('warns on a bare sibling name, which names nothing from this node', () => {
    expectDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Sprite2D', {}, { name: 'Target', parent: '.' }),
        node('RemoteTransform2D', { remote_path: 'NodePath("Target")' }, { parent: '.' })
      ),
      { ruleName: RULE_NAME, severity: 'warning' }
    );
  });

  it('passes on the ../ form the inspector writes for a sibling', () => {
    expectNoDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Sprite2D', {}, { name: 'Target', parent: '.' }),
        node('RemoteTransform2D', { remote_path: 'NodePath("../Target")' }, { parent: '.' })
      ),
      { ruleName: RULE_NAME }
    );
  });

  // Repeated names across parents used to force a decline, because matching by
  // name alone could not tell them apart. A real walk can: `../Other/Target`
  // names exactly one node no matter how many others share the name.
  it('resolves a repeated name by its path rather than declining', () => {
    expectNoDiagnostic(
      scene(
        node('Node2D', {}, { name: 'Root' }),
        node('Sprite2D', {}, { name: 'Target', parent: '.' }),
        node('Sprite2D', {}, { name: 'Other', parent: '.' }),
        node('Node2D', {}, { name: 'Target', parent: 'Other' }),
        node(
          'RemoteTransform2D',
          { remote_path: 'NodePath("../Other/Target")' },
          { parent: '.' }
        )
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
