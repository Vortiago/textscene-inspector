/**
 * TextEdit self-registration: importing `index.r3f` must wire the native
 * painter and the size-dependent rect solver into their respective registries.
 */
import { describe, expect, it } from 'vitest';
import './index.r3f';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { TextEdit } from './Component';
import { textEditMinimumSize } from './nativeSolver';

describe('TextEdit index.r3f self-registration', () => {
  it('registers the native painter', () => {
    expect(controlComponentRegistry.get('TextEdit')).toBe(TextEdit);
  });

  it('registers the minimum-size solver', () => {
    expect(controlSolverRegistry.minimumSize('TextEdit')).toBe(textEditMinimumSize);
  });

  it("declares TextEdit size-dependent, so scroll_fit_content_height at wrap_mode BOUNDARY gets solveControlTree's second pass", () => {
    expect(controlSolverRegistry.isSizeDependentMinimum('TextEdit')).toBe(true);
  });

  it('registers no container layout — a TextEdit has no Control children to place', () => {
    expect(controlSolverRegistry.containerLayout('TextEdit')).toBeUndefined();
  });
});
