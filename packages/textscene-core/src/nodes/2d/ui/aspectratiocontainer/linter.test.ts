/**
 * AspectRatioContainer semantic linting, the one condition that needs the
 * surrounding tree rather than the node's own properties: a direct
 * TextureRect child using a proportional expand_mode.
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic, expectNoErrors } from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

/** A Control root holding an AspectRatioContainer with the given children. */
function containerScene(children: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Control"]

[node name="Frame" type="AspectRatioContainer" parent="."]
ratio = 1.5
${children}`;
}

describe('AspectRatioContainer linter', () => {
  describe('format validators (warnings)', () => {
    it('accepts valid property values', () => {
      expectClean(containerScene(''));
    });

    it('warns on a ratio below the hinted floor rather than erroring', () => {
      expectDiagnostic(scene(node('AspectRatioContainer', { ratio: 0 })), {
        prop: 'ratio',
        severity: 'warning',
      });
    });
  });

  describe('semantic rules (warnings)', () => {
    it('warns on a direct TextureRect child with EXPAND_FIT_WIDTH_PROPORTIONAL (3)', () => {
      const content = containerScene(`
[node name="Art" type="TextureRect" parent="Frame"]
expand_mode = 3
`);
      expectDiagnostic(content, {
        ruleName: 'aspectratiocontainer-unsupported-texturerect-expand-mode',
        severity: 'warning',
      });
      expectNoErrors(content);
    });

    // `as_sortable_control` (container.cpp:143-153) rejects these before the sort
    // pass reads expand_mode at aspect_ratio_container.cpp:112, so Godot prints
    // nothing for them.
    it.each([
      ['visible = false', 'visible = false'],
      ['top_level = true', 'top_level = true'],
    ])('stays silent on a proportional TextureRect with %s', (_label, extra) => {
      expectNoDiagnostic(
        containerScene(`
[node name="Art" type="TextureRect" parent="Frame"]
expand_mode = 3
${extra}
`),
        { ruleName: 'aspectratiocontainer-unsupported-texturerect-expand-mode' }
      );
    });

    it('warns on a direct TextureRect child with EXPAND_FIT_HEIGHT_PROPORTIONAL (5)', () => {
      expectDiagnostic(
        containerScene(`
[node name="Art" type="TextureRect" parent="Frame"]
expand_mode = 5
`),
        { ruleName: 'aspectratiocontainer-unsupported-texturerect-expand-mode', severity: 'warning' }
      );
    });

    it('is silent for a non-proportional expand_mode', () => {
      expectNoDiagnostic(
        containerScene(`
[node name="Art" type="TextureRect" parent="Frame"]
expand_mode = 2
`),
        { ruleName: 'aspectratiocontainer-unsupported-texturerect-expand-mode' }
      );
    });

    it('is silent for a TextureRect with no expand_mode set (default EXPAND_KEEP_SIZE)', () => {
      expectNoDiagnostic(
        containerScene(`
[node name="Art" type="TextureRect" parent="Frame"]
`),
        { ruleName: 'aspectratiocontainer-unsupported-texturerect-expand-mode' }
      );
    });

    it('is silent for a proportional TextureRect nested under a grandchild, matching get_child(i)', () => {
      // aspect_ratio_container.cpp:103 loops get_child(i) directly: only an
      // immediate child is ever passed to as_sortable_control, so a TextureRect
      // one level deeper never reaches the check this rule mirrors.
      expectNoDiagnostic(
        containerScene(`
[node name="Inner" type="Control" parent="Frame"]

[node name="Art" type="TextureRect" parent="Frame/Inner"]
expand_mode = 3
`),
        { ruleName: 'aspectratiocontainer-unsupported-texturerect-expand-mode' }
      );
    });
  });
});
