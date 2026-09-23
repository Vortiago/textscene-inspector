/**
 * Timer strict validators: the type-specific property surface. Timer is a plain
 * Node (nodeBaseTypes.ts), so it has no spatial validators.
 */

import { describe, it } from 'vitest';
import './linterParser';
import { expectDiagnostic, expectNoErrors, node, scene } from '../../../linter/testing/testkit';

describe('Timer strict validators', () => {
  it('passes a valid Timer with wait_time/autostart/one_shot/process_callback', () => {
    expectNoErrors(
      scene(
        node('Timer', {
          wait_time: 1.5,
          autostart: true,
          one_shot: true,
          paused: false,
          process_callback: 0,
          ignore_time_scale: false,
        })
      )
    );
  });

  it('rejects a non-positive wait_time', () => {
    expectDiagnostic(scene(node('Timer', { wait_time: 0 })), {
      prop: 'wait_time',
      severity: 'error',
    });
  });

  // timer.cpp:93 refuses `<= 0` while the hint (:240,
  // "0.001,4096,0.001,or_greater,exp,suffix:s") floors at 0.001, so (0, 0.001)
  // loads into Godot and the inspector still excludes it.
  it('warns between the refused wait_time floor and the hinted one', () => {
    expectDiagnostic(scene(node('Timer', { wait_time: 0.0005 })), {
      ruleName: 'strict-parser',
      severity: 'warning',
      contains: ['wait_time', '0.001'],
    });
    expectNoErrors(scene(node('Timer', { wait_time: 0.001 })));
  });

  it('warns on an out-of-range process_callback', () => {
    // timer.cpp:163-179: set_timer_process_callback is a bare switch and assign
    // with no range check, so out-of-range is a warning (ADR-0032).
    expectDiagnostic(scene(node('Timer', { process_callback: 5 })), {
      prop: 'process_callback',
      severity: 'warning',
    });
  });
});
