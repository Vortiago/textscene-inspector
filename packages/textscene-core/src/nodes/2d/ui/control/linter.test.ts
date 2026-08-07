/**
 * Control linter tests — `Control::get_configuration_warnings()`
 * (control.cpp:246-256): a tooltip that can never show because the resolved
 * Mouse Filter is Ignore.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linter';

describe('Control Linter (control-tooltip-ignored-by-mouse-filter)', () => {
  it('warns on a plain Control with tooltip_text and mouse_filter explicitly Ignore', () => {
    const diagnostic = expectDiagnostic(
      scene(node('Control', { tooltip_text: '"Hello"', mouse_filter: 2 })),
      { ruleName: 'control-tooltip-ignored-by-mouse-filter', severity: 'warning' }
    );
    expect(diagnostic.message).toContain('Ignore');
  });

  it('stays silent when mouse_filter is Stop or Pass', () => {
    expectNoDiagnostic(scene(node('Control', { tooltip_text: '"Hello"', mouse_filter: 0 })), {
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
    });
    expectNoDiagnostic(scene(node('Control', { tooltip_text: '"Hello"', mouse_filter: 1 })), {
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
    });
  });

  it('stays silent when tooltip_text is absent', () => {
    expectNoDiagnostic(scene(node('Control', { mouse_filter: 2 })), {
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
    });
  });

  it('stays silent when tooltip_text is an authored empty string', () => {
    expectNoDiagnostic(scene(node('Control', { tooltip_text: '""', mouse_filter: 2 })), {
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
    });
  });

  it('stays silent on plain Control with tooltip_text and mouse_filter absent — Control defaults to Stop', () => {
    expectNoDiagnostic(scene(node('Control', { tooltip_text: '"Hello"' })), {
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
    });
  });

  it('warns on Label with tooltip_text and mouse_filter absent — Label defaults to Ignore (label.cpp:1477)', () => {
    expectDiagnostic(scene(node('Label', { tooltip_text: '"Hello"' })), {
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
      severity: 'warning',
      nodeType: 'Label',
    });
  });

  it('warns on NinePatchRect with tooltip_text and mouse_filter absent — its own default is Ignore (nine_patch_rect.cpp:191)', () => {
    expectDiagnostic(scene(node('NinePatchRect', { tooltip_text: '"Hello"' })), {
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
      severity: 'warning',
      nodeType: 'NinePatchRect',
    });
  });

  it('stays silent on Label when mouse_filter is explicitly overridden away from Ignore', () => {
    expectNoDiagnostic(scene(node('Label', { tooltip_text: '"Hello"', mouse_filter: 0 })), {
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
    });
  });

  it('stays silent on a Container descendant, whose default is Pass, not Ignore', () => {
    expectNoDiagnostic(scene(node('Container', { tooltip_text: '"Hello"' })), {
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
    });
  });

  it('reaches a Control subclass through the family matcher (HBoxContainer, no own default override)', () => {
    expectNoDiagnostic(scene(node('HBoxContainer', { tooltip_text: '"Hello"', mouse_filter: 1 })), {
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
    });
    expectDiagnostic(scene(node('HBoxContainer', { tooltip_text: '"Hello"', mouse_filter: 2 })), {
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
      severity: 'warning',
    });
  });
});
