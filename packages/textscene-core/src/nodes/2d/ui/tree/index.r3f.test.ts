/** Tree self-registration: importing `index.r3f` must wire the native painter, and only the painter — Tree registers no solver. */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { Tree } from './Component';

describe('Tree index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('Tree')).toBe(Tree);
  });

  it('registers no minimum-size solver — Tree overrides no get_minimum_size', () => {
    expect(controlSolverRegistry.minimumSize('Tree')).toBeUndefined();
  });

  it('registers no container layout — a Tree has no Control children to place', () => {
    expect(controlSolverRegistry.containerLayout('Tree')).toBeUndefined();
  });
});
