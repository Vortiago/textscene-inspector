/**
 * VFlowContainer self-registration: importing `index.r3f` must wire the
 * native (WebGL canvas) painter, and the shared flow solver, which registers
 * itself for `VFlowContainer` too.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { VFlowContainer } from './Component';

describe('VFlowContainer index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('VFlowContainer')).toBe(VFlowContainer);
  });

  it('registers the shared minimum-size solver', () => {
    const shared = controlSolverRegistry.minimumSize('FlowContainer');
    expect(shared).toBeTypeOf('function');
    expect(controlSolverRegistry.minimumSize('VFlowContainer')).toBe(shared);
  });

  it('registers the shared container-layout solver', () => {
    const shared = controlSolverRegistry.containerLayout('FlowContainer');
    expect(shared).toBeTypeOf('function');
    expect(controlSolverRegistry.containerLayout('VFlowContainer')).toBe(shared);
  });
});
