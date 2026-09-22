/**
 * HSeparator self-registration: importing `index.r3f` must wire the native
 * (WebGL canvas) painter and the minimum-size solver into their registries.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { HSeparator } from './Component';
import { hSeparatorMinimumSize } from './nativeSolver';

describe('HSeparator index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('HSeparator')).toBe(HSeparator);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('HSeparator')).toBe(hSeparatorMinimumSize);
  });
});
