/**
 * CheckBox registration contract: the parser self-registers in the NodeRegistry
 * and the native (WebGL canvas) painter self-registers in the
 * ControlComponentRegistry (Controls render via the native 2D-UI canvas,
 * ADR-0002 — NOT the 3D NodeComponentRegistry, and they carry no linter slice).
 */
import { describe, it, expect } from 'vitest';
import './index'; // parser registration side effect
import './index.r3f'; // native component registration side effect
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { parseCheckBox } from './parser';
import { CheckBox } from './Component';
import { checkBoxMinimumSize } from './nativeSolver';

describe('CheckBox registration', () => {
  it('registers the parser under its type name', () => {
    const reg = nodeRegistry.getRegistration('CheckBox');
    expect(reg).not.toBeNull();
    expect(reg!.parser).toBe(parseCheckBox);
  });

  it('registers the native (WebGL) painter and rect solver', () => {
    expect(controlComponentRegistry.get('CheckBox')).toBe(CheckBox);
    expect(controlSolverRegistry.minimumSize('CheckBox')).toBe(checkBoxMinimumSize);
  });
});
