/**
 * Label linter tests — `Label::get_configuration_warnings()` (label.cpp:620-635):
 * autowrap enabled under a Container parent, still at the default (0, 0)
 * custom_minimum_size.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linter';

describe('Label autowrap under a Container — a non-finite mode is not autowrap', () => {
  it('stays silent when autowrap_mode is nan', () => {
    // `NaN !== AUTOWRAP_OFF` is true, so an inequality read it as autowrap on.
    expectNoDiagnostic(
      scene(
        node('VBoxContainer', {}, { name: 'Box' }),
        node('Label', { autowrap_mode: 'nan' }, { parent: '.' })
      ),
      { ruleName: 'label-autowrap-needs-custom-minimum-size' }
    );
  });
});

describe('Label Linter (label-autowrap-needs-custom-minimum-size)', () => {
  it('warns when autowrap is enabled under a Container parent with no custom_minimum_size', () => {
    const diagnostic = expectDiagnostic(
      scene(node('VBoxContainer', {}, { name: 'Column' }), node('Label', { autowrap_mode: 2 }, { parent: '.' })),
      { ruleName: 'label-autowrap-needs-custom-minimum-size', severity: 'warning' }
    );
    expect(diagnostic.message).toContain('Column');
  });

  it('warns when custom_minimum_size is explicitly authored as (0, 0)', () => {
    expectDiagnostic(
      scene(
        node('VBoxContainer', {}, { name: 'Column' }),
        node('Label', { autowrap_mode: 3, custom_minimum_size: 'Vector2(0, 0)' }, { parent: '.' })
      ),
      { ruleName: 'label-autowrap-needs-custom-minimum-size', severity: 'warning' }
    );
  });

  it('stays silent once custom_minimum_size is non-zero', () => {
    expectNoDiagnostic(
      scene(
        node('VBoxContainer', {}, { name: 'Column' }),
        node('Label', { autowrap_mode: 2, custom_minimum_size: 'Vector2(100, 0)' }, { parent: '.' })
      ),
      { ruleName: 'label-autowrap-needs-custom-minimum-size' }
    );
  });

  it('stays silent when autowrap_mode is absent (defaults OFF)', () => {
    expectNoDiagnostic(scene(node('VBoxContainer', {}, { name: 'Column' }), node('Label', {}, { parent: '.' })), {
      ruleName: 'label-autowrap-needs-custom-minimum-size',
    });
  });

  it('stays silent when autowrap_mode is explicitly OFF (0)', () => {
    expectNoDiagnostic(
      scene(node('VBoxContainer', {}, { name: 'Column' }), node('Label', { autowrap_mode: 0 }, { parent: '.' })),
      { ruleName: 'label-autowrap-needs-custom-minimum-size' }
    );
  });

  it('stays silent when the parent is not a Container (plain Control)', () => {
    expectNoDiagnostic(
      scene(node('Control', {}, { name: 'Root' }), node('Label', { autowrap_mode: 2 }, { parent: '.' })),
      { ruleName: 'label-autowrap-needs-custom-minimum-size' }
    );
  });

  it('stays silent at the scene root — no parent at all', () => {
    expectNoDiagnostic(scene(node('Label', { autowrap_mode: 2 })), {
      ruleName: 'label-autowrap-needs-custom-minimum-size',
    });
  });

  it('reaches a Container subclass parent (PanelContainer), not just the exact class', () => {
    expectDiagnostic(
      scene(node('PanelContainer', {}, { name: 'Card' }), node('Label', { autowrap_mode: 1 }, { parent: '.' })),
      { ruleName: 'label-autowrap-needs-custom-minimum-size', severity: 'warning' }
    );
  });
});
