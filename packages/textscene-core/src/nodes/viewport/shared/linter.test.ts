/**
 * Viewport shared size rule — `Viewport::get_configuration_warnings()`
 * (viewport.cpp:3706-3714): `size.x <= 1 || size.y <= 1`.
 *
 * `Window` and its descendants (AcceptDialog, Popup, …) are where this fires;
 * `SubViewport` is deliberately excluded — its own `size` validator already
 * floors both components at 2, an error-tier defect for the same values.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linter';

describe('viewport size with a component no int32 holds', () => {
  it('says nothing rather than naming NaN as the size', () => {
    for (const spelling of ['inf', 'nan', 'inf_neg']) {
      expectNoDiagnostic(scene(node('SubViewport', { size: `Vector2i(${spelling}, 1080)` })), {
        ruleName: 'viewport-size-too-small',
      });
    }
  });
});

/**
 * Phase 2 runs after a phase-1 error (`linter/Linter.ts:32` gates on a parsed
 * scene, not an error-free one), so a converted spelling whose component no
 * int32 holds reaches this rule. `Vector2` holds DOUBLES: `4294967295` narrows
 * through `double -> int32` to the UB sentinel, not the -1 the `Vector2i`
 * spelling of the same digits wraps to. Measured on 4.6.3.
 */
describe('viewport size with a CONVERTED component no int32 holds', () => {
  it('says nothing rather than naming Vector2i(-1, 1080) as the size', () => {
    expectNoDiagnostic(scene(node('Window', { size: 'Vector2(4294967295, 1080)' })), {
      ruleName: 'viewport-size-too-small',
    });
  });

  it('still warns on the canonical spelling of the same digits', () => {
    expectDiagnostic(scene(node('Window', { size: 'Vector2i(4294967295, 1080)' })), {
      ruleName: 'viewport-size-too-small',
      severity: 'warning',
      contains: ['Vector2i(-1, 1080)'],
    });
  });
});

describe('Viewport size rule (viewport-size-too-small)', () => {
  it('warns on a Window with size.x <= 1', () => {
    const diagnostic = expectDiagnostic(scene(node('Window', { size: 'Vector2i(1, 480)' })), {
      ruleName: 'viewport-size-too-small',
      severity: 'warning',
    });
    expect(diagnostic.message).toContain('size');
  });

  it('warns on a Window with size.y <= 1', () => {
    expectDiagnostic(scene(node('Window', { size: 'Vector2i(640, 0)' })), {
      ruleName: 'viewport-size-too-small',
      severity: 'warning',
    });
  });

  it('stays silent once both dimensions exceed 1', () => {
    expectNoDiagnostic(scene(node('Window', { size: 'Vector2i(2, 2)' })), {
      ruleName: 'viewport-size-too-small',
    });
  });

  it('stays silent when size is absent — Window defaults to (100, 100)', () => {
    expectNoDiagnostic(scene(node('Window')), { ruleName: 'viewport-size-too-small' });
  });

  it('reaches a Window descendant (Popup, AcceptDialog), not just the exact class', () => {
    expectDiagnostic(scene(node('Popup', { size: 'Vector2i(1, 1)' })), {
      ruleName: 'viewport-size-too-small',
      severity: 'warning',
    });
    expectDiagnostic(scene(node('AcceptDialog', { size: 'Vector2i(1, 1)' })), {
      ruleName: 'viewport-size-too-small',
      severity: 'warning',
    });
  });

  it('never fires on SubViewport — its own error-tier validator already floors size at 2', () => {
    expectNoDiagnostic(scene(node('SubViewport', { size: 'Vector2i(1, 1)' })), {
      ruleName: 'viewport-size-too-small',
    });
  });

  it('never fires on unrelated node types', () => {
    expectNoDiagnostic(scene(node('Control', { size: 'Vector2i(1, 1)' })), {
      ruleName: 'viewport-size-too-small',
    });
  });
});
