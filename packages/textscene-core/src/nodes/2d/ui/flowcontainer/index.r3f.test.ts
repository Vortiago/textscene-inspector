/**
 * FlowContainer self-registration: importing `index.r3f` wires the native painter
 * and both rect-solver functions for all three flow types.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { FlowContainer } from './Component';

describe('FlowContainer index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('FlowContainer')).toBe(FlowContainer);
  });

  it.each(['FlowContainer', 'HFlowContainer', 'VFlowContainer'])(
    'registers the minimum-size solver for %s',
    (typeName) => {
      const shared = controlSolverRegistry.minimumSize('FlowContainer');
      expect(shared).toBeTypeOf('function');
      expect(controlSolverRegistry.minimumSize(typeName)).toBe(shared);
      expect(controlSolverRegistry.isSizeDependentMinimum(typeName)).toBe(true);
    }
  );

  it.each(['FlowContainer', 'HFlowContainer', 'VFlowContainer'])(
    'registers the container-layout solver for %s',
    (typeName) => {
      const shared = controlSolverRegistry.containerLayout('FlowContainer');
      expect(shared).toBeTypeOf('function');
      expect(controlSolverRegistry.containerLayout(typeName)).toBe(shared);
    }
  );
});
