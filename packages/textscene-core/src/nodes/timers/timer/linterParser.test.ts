/**
 * Timer strict validator coverage — the type-specific property surface.
 * Timer is a plain Node (see nodeBaseTypes.ts), so there are no spatial
 * validators to exercise here.
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

  it('warns on an out-of-range process_callback', () => {
    // timer.cpp:163-179, set_timer_process_callback is a bare switch/assign; no
    // engine-side range check, so out-of-range is a warning (ADR-0032).
    expectDiagnostic(scene(node('Timer', { process_callback: 5 })), {
      prop: 'process_callback',
      severity: 'warning',
    });
  });
});
