/**
 * Control property-order rule.
 *
 * `Control::_set_anchors_layout_preset` is a setter with sibling side effects
 * (`scene/gui/control.cpp:982-1032`), and `SceneState::instantiate` applies a
 * node's properties in FILE order (`scene/resources/packed_scene.cpp`). So an
 * `anchor_*`/`offset_*`/`grow_*` line written before `anchors_preset` is
 * silently overwritten by it, and `anchors_preset` written before `layout_mode`
 * no-ops entirely — both measured against real Godot 4.6.3, not derived here.
 * `node()` (testkit) renders `[key = value]` lines in the ORDER its `props`
 * object lists them, which is exactly the file order this rule reads.
 */

import { describe, it, expect } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

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
