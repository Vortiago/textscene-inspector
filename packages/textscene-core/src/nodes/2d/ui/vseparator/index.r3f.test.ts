/**
 * VSeparator self-registration: importing `index.r3f` must wire the native
 * (WebGL canvas) painter and the minimum-size solver into their registries.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { VSeparator } from './Component';
import { vSeparatorMinimumSize } from './nativeSolver';

describe('VSeparator index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('VSeparator')).toBe(VSeparator);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('VSeparator')).toBe(vSeparatorMinimumSize);
  });
});
