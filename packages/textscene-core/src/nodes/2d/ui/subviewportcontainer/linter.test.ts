/**
 * SubViewportContainer linting — the first Control slice to carry lint code
 * (`barrelCompleteness` documents which Controls carry one).
 *
 * It earns one because the container is the only Control whose correctness
 * depends on its CHILDREN: with no SubViewport child it draws nothing at all,
 * which no format check can see.
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic, expectNoErrors } from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

/** A Control root holding a SubViewportContainer with the given children. */
function containerScene(children: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Control"]

[node name="Booth" type="SubViewportContainer" parent="."]
stretch = true
${children}`;
}

describe('SubViewportContainer cursor shape — only a shape the node can hold', () => {
  it('says nothing about a non-finite or out-of-enum cursor', () => {
    // `Control::CursorShape` runs 0-16 (control.h:180-197). A value outside it
    // is not "a shape other than Arrow", it is not a shape.
    for (const shape of ['inf', 'nan', '99', '2e1']) {
      expectNoDiagnostic(
        scene(node('SubViewportContainer', { mouse_default_cursor_shape: shape })),
        { ruleName: 'subviewportcontainer-non-arrow-cursor' }
      );
    }
  });

  it('still warns on a real non-Arrow shape', () => {
    expectDiagnostic(scene(node('SubViewportContainer', { mouse_default_cursor_shape: 2 })), {
      ruleName: 'subviewportcontainer-non-arrow-cursor',
      severity: 'warning',
    });
  });
});

describe('SubViewportContainer linter', () => {
  describe('format validators (errors)', () => {
    it('accepts valid stretch / stretch_shrink', () => {
      expectClean(
        containerScene(`
[node name="View" type="SubViewport" parent="Booth"]
size = Vector2i(200, 150)
`)
      );
    });

    it('rejects a non-boolean stretch', () => {
      expectDiagnostic(scene(node('SubViewportContainer', { stretch: 'sure' })), {
        prop: 'stretch',
        severity: 'error',
      });
    });

    it('rejects stretch_shrink below 1 — Godot ERR_FAIL_CONDs on it', () => {
      expectDiagnostic(scene(node('SubViewportContainer', { stretch_shrink: 0 })), {
        prop: 'stretch_shrink',
        severity: 'error',
      });
    });
  });

  describe('semantic rules (warnings)', () => {
    it('warns when the container has no SubViewport child — it displays nothing', () => {
      const content = containerScene(`
[node name="NotAViewport" type="ColorRect" parent="Booth"]
`);
      expectDiagnostic(content, {
        ruleName: 'subviewportcontainer-no-viewport',
        severity: 'warning',
      });
      expectNoErrors(content);
    });

    it('warns for a container with no children at all', () => {
      expectDiagnostic(containerScene(''), {
        ruleName: 'subviewportcontainer-no-viewport',
        severity: 'warning',
      });
    });

    it('is silent when a SubViewport child is present', () => {
      expectNoDiagnostic(
        containerScene(`
[node name="View" type="SubViewport" parent="Booth"]
size = Vector2i(200, 150)
`),
        { ruleName: 'subviewportcontainer-no-viewport' }
      );
    });

    it('is silent for MULTIPLE SubViewport children — Godot draws them all, stacked', () => {
      // `SubViewportContainer::_notification(NOTIFICATION_DRAW)` loops every
      // SubViewport child and draws each, so more than one is legal, not suspect.
      expectNoDiagnostic(
        containerScene(`
[node name="A" type="SubViewport" parent="Booth"]

[node name="B" type="SubViewport" parent="Booth"]
`),
        { ruleName: 'subviewportcontainer-no-viewport' }
      );
    });

    it('warns when mouse_default_cursor_shape is set away from Arrow (subviewport_container.cpp:283)', () => {
      const content = containerScene(`
mouse_default_cursor_shape = 2
[node name="View" type="SubViewport" parent="Booth"]
size = Vector2i(200, 150)
`);
      expectDiagnostic(content, {
        ruleName: 'subviewportcontainer-non-arrow-cursor',
        severity: 'warning',
      });
      expectNoErrors(content);
    });

    it('stays silent when mouse_default_cursor_shape is absent (defaults to Arrow, control.h:245)', () => {
      expectNoDiagnostic(
        containerScene(`
[node name="View" type="SubViewport" parent="Booth"]
size = Vector2i(200, 150)
`),
        { ruleName: 'subviewportcontainer-non-arrow-cursor' }
      );
    });

    it('stays silent when mouse_default_cursor_shape is explicitly Arrow (0)', () => {
      expectNoDiagnostic(
        containerScene(`
mouse_default_cursor_shape = 0
[node name="View" type="SubViewport" parent="Booth"]
size = Vector2i(200, 150)
`),
        { ruleName: 'subviewportcontainer-non-arrow-cursor' }
      );
    });

    it('stays silent when a child is an instance — the file cannot see inside it', () => {
      // Instance-opaque linting (CONTEXT.md): the instanced sub-scene's root may
      // well BE a SubViewport, and the linter never resolves across an instance
      // boundary. Warning here would false-positive on a normal Godot idiom.
      expectNoDiagnostic(
        `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://booth.tscn" id="1"]

[node name="Root" type="Control"]

[node name="Booth" type="SubViewportContainer" parent="."]

[node name="Maybe" parent="Booth" instance=ExtResource("1")]
`,
        { ruleName: 'subviewportcontainer-no-viewport' }
      );
    });
  });
});
