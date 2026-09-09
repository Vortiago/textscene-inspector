/**
 * ScrollContainer linter tests —
 * `ScrollContainer::get_configuration_warnings()` (scroll_container.cpp:768-786):
 * not exactly one sortable Control child.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linter';

describe('ScrollContainer Linter (scrollcontainer-not-single-child)', () => {
  it('passes with exactly one Control child', () => {
    expectNoDiagnostic(
      scene(node('ScrollContainer'), node('VBoxContainer', {}, { parent: '.' })),
      { ruleName: 'scrollcontainer-not-single-child' }
    );
  });

  it('warns with zero children', () => {
    const diagnostic = expectDiagnostic(scene(node('ScrollContainer')), {
      ruleName: 'scrollcontainer-not-single-child',
      severity: 'warning',
    });
    expect(diagnostic.message).toContain('0');
  });

  it('warns with two sortable Control children', () => {
    const diagnostic = expectDiagnostic(
      scene(
        node('ScrollContainer'),
        node('Label', {}, { name: 'A', parent: '.' }),
        node('Label', {}, { name: 'B', parent: '.' })
      ),
      { ruleName: 'scrollcontainer-not-single-child', severity: 'warning' }
    );
    expect(diagnostic.message).toContain('2');
  });

  it('does not count a child explicitly hidden (visible = false) — as_sortable_control checks LOCAL visibility', () => {
    expectNoDiagnostic(
      scene(
        node('ScrollContainer'),
        node('VBoxContainer', {}, { name: 'Visible', parent: '.' }),
        node('Label', { visible: false }, { name: 'Hidden', parent: '.' })
      ),
      { ruleName: 'scrollcontainer-not-single-child' }
    );
  });

  it('does not count a child with top_level = true', () => {
    expectNoDiagnostic(
      scene(
        node('ScrollContainer'),
        node('VBoxContainer', {}, { name: 'Visible', parent: '.' }),
        node('Label', { top_level: true }, { name: 'Floating', parent: '.' })
      ),
      { ruleName: 'scrollcontainer-not-single-child' }
    );
  });

  it('does not count a non-Control child (e.g. a Node used purely for grouping), so one Control plus one Node still passes', () => {
    expectNoDiagnostic(
      scene(
        node('ScrollContainer'),
        node('VBoxContainer', {}, { name: 'Visible', parent: '.' }),
        node('Node', {}, { name: 'Helper', parent: '.' })
      ),
      { ruleName: 'scrollcontainer-not-single-child' }
    );
  });

  it('warns when the ONLY children are non-Control (zero sortable controls)', () => {
    expectDiagnostic(
      scene(node('ScrollContainer'), node('Node', {}, { name: 'Helper', parent: '.' })),
      { ruleName: 'scrollcontainer-not-single-child', severity: 'warning' }
    );
  });

  it('stays silent when a child is an opaque instance — its real class is unknowable', () => {
    expectNoDiagnostic(
      scene('[node name="ScrollContainer" type="ScrollContainer"]', '[node name="Sub" parent="." instance=ExtResource("1")]'),
      { ruleName: 'scrollcontainer-not-single-child' }
    );
  });

  it('never fires on other node types', () => {
    expectNoDiagnostic(scene(node('VBoxContainer')), { ruleName: 'scrollcontainer-not-single-child' });
  });
});
