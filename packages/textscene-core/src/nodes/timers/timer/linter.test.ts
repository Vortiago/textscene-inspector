/**
 * Timer linter tests — `Timer::get_configuration_warnings()` (timer.cpp:200-208):
 * a positive wait_time below 0.05 - CMP_EPSILON.
 */
import { describe, it, expect } from 'vitest';
import { node, scene, expectDiagnostic, expectNoDiagnostic } from '../../../linter/testing/testkit';
import './linter';

describe('Timer Linter (timer-low-wait-time)', () => {
  it('warns on a very low positive wait_time', () => {
    const diagnostic = expectDiagnostic(scene(node('Timer', { wait_time: 0.01 })), {
      ruleName: 'timer-low-wait-time',
      severity: 'warning',
    });
    expect(diagnostic.message).toContain('wait_time');
  });

  it('stays silent at exactly the threshold and above', () => {
    expectNoDiagnostic(scene(node('Timer', { wait_time: 0.05 })), { ruleName: 'timer-low-wait-time' });
    expectNoDiagnostic(scene(node('Timer', { wait_time: 1.5 })), { ruleName: 'timer-low-wait-time' });
  });

  it('stays silent when wait_time is absent', () => {
    expectNoDiagnostic(scene(node('Timer')), { ruleName: 'timer-low-wait-time' });
  });

  it('leaves wait_time <= 0 to the existing error validator, not this rule', () => {
    expectNoDiagnostic(scene(node('Timer', { wait_time: 0 })), { ruleName: 'timer-low-wait-time' });
    expectNoDiagnostic(scene(node('Timer', { wait_time: -1 })), { ruleName: 'timer-low-wait-time' });
  });

  it('never fires on other node types', () => {
    expectNoDiagnostic(scene(node('Node', { wait_time: 0.01 })), { ruleName: 'timer-low-wait-time' });
  });
});
