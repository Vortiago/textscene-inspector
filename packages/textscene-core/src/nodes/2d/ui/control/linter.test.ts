/**
 * Control rules: the `anchors_preset` file order (`scene/gui/control.cpp:982-1032`,
 * `scene/resources/packed_scene.cpp`, measured in Godot 4.6.3), and the tooltip that
 * Mouse Filter Ignore hides (control.cpp:246-256). `node()` writes the props in key order.
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
} from '../../../../linter/testing/testkit';
import './linter';
import './linterParser';

describe('Control property-order rule', () => {
  it('warns when offset_* is authored before anchors_preset — the preset wipes it', () => {
    const content = scene(
      node('Control', {
        layout_mode: 1,
        offset_left: 40,
        offset_top: 40,
        offset_right: 240,
        offset_bottom: 160,
        anchors_preset: 15,
      })
    );
    expectDiagnostic(content, {
      ruleName: 'control-property-order',
      severity: 'warning',
      contains: ['offset_left', 'anchors_preset'],
    });
  });

  it('warns when anchor_* is authored before anchors_preset', () => {
    const content = scene(
      node('Control', {
        layout_mode: 1,
        anchor_left: 0.25,
        anchors_preset: 15,
      })
    );
    expectDiagnostic(content, {
      ruleName: 'control-property-order',
      contains: ['anchor_left'],
    });
  });

  it('warns when grow_horizontal/grow_vertical are authored before anchors_preset', () => {
    const content = scene(
      node('Control', {
        layout_mode: 1,
        grow_horizontal: 2,
        grow_vertical: 2,
        anchors_preset: 15,
      })
    );
    const diag = expectDiagnostic(content, { ruleName: 'control-property-order' });
    expect(diag.message).toContain('grow_horizontal');
    expect(diag.message).toContain('grow_vertical');
  });

  it('warns when layout_mode is authored AFTER anchors_preset — the preset never fires', () => {
    const content = scene(
      node('Control', {
        anchors_preset: 15,
        layout_mode: 1,
      })
    );
    expectDiagnostic(content, {
      ruleName: 'control-property-order',
      contains: ["'layout_mode'", "'anchors_preset'"],
    });
  });

  it('is clean when offset_* is authored AFTER anchors_preset — Godot parity order', () => {
    expectClean(
      scene(
        node('Control', {
          layout_mode: 1,
          anchors_preset: 15,
          offset_left: 40,
          offset_top: 40,
          offset_right: 240,
          offset_bottom: 160,
        })
      )
    );
  });

  it('is clean when layout_mode is authored before anchors_preset (the normal editor order)', () => {
    expectClean(
      scene(
        node('Control', {
          layout_mode: 1,
          anchors_preset: 15,
        })
      )
    );
  });

  it('stays silent with no anchors_preset at all — a container-managed child (layout_mode = 2)', () => {
    expectNoDiagnostic(
      scene(
        node('Control', {
          layout_mode: 2,
          offset_left: 40,
        })
      ),
      { ruleName: 'control-property-order' }
    );
  });

  it('stays silent when layout_mode is absent — the preset is always inert regardless of order', () => {
    expectNoDiagnostic(
      scene(
        node('Control', {
          offset_left: 40,
          anchors_preset: 15,
        })
      ),
      { ruleName: 'control-property-order' }
    );
  });

  it('stays silent for the -1 custom-anchors sentinel — the setter returns before touching anything', () => {
    expectNoDiagnostic(
      scene(
        node('Control', {
          layout_mode: 1,
          offset_left: 40,
          anchors_preset: -1,
        })
      ),
      { ruleName: 'control-property-order' }
    );
  });

  it('reaches a Control subclass through the base-type walk (Button)', () => {
    const content = scene(
      node('Button', {
        layout_mode: 1,
        offset_left: 40,
        anchors_preset: 15,
      })
    );
    expectDiagnostic(content, { ruleName: 'control-property-order', nodeType: 'Button' });
  });
});

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
