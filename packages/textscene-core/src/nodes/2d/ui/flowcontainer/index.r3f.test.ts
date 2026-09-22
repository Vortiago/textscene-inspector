/**
 * FlowContainer self-registration: importing `index.r3f` must wire the
 * native (WebGL canvas) painter and both native rect-solver functions for
 * ALL THREE flow types into their respective registries.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { FlowContainer } from './Component';
import { flowContainerMinimumSize, flowContainerLayout } from './nativeSolver';

describe('FlowContainer index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('FlowContainer')).toBe(FlowContainer);
  });

  it.each(['FlowContainer', 'HFlowContainer', 'VFlowContainer'])(
    'registers the minimum-size solver for %s',
    (typeName) => {
      expect(controlSolverRegistry.minimumSize(typeName)).toBe(flowContainerMinimumSize);
      expect(controlSolverRegistry.isSizeDependentMinimum(typeName)).toBe(true);
    }
  );

  it.each(['FlowContainer', 'HFlowContainer', 'VFlowContainer'])(
    'registers the container-layout solver for %s',
    (typeName) => {
      expect(controlSolverRegistry.containerLayout(typeName)).toBe(flowContainerLayout);
    }
  );
});
