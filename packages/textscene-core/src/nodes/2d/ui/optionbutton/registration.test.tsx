/**
 * OptionButton registration contract: parser self-registers in the NodeRegistry,
 * DOM-overlay component self-registers in the ControlComponentRegistry (ADR-0003).
 */
import { describe, it, expect } from 'vitest';
import './index'; // parser registration side effect
import './index.r3f'; // DOM-overlay component registration side effect
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { parseOptionButton } from './parser';
import { OptionButton } from './Component';

describe('OptionButton registration', () => {
  it('registers the parser under its type name', () => {
    const reg = nodeRegistry.getRegistration('OptionButton');
    expect(reg).not.toBeNull();
    expect(reg!.parser).toBe(parseOptionButton);
  });

  it('registers the DOM-overlay component in the control registry', () => {
    expect(controlComponentRegistry.get('OptionButton')).toBe(OptionButton);
  });
});
