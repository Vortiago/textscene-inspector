import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseCheckButton } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseCheckButton', () => {
  it('reads text, the checked flag and disabled through Button\'s own parse', () => {
    const p = parseCheckButton(h({ name: 'Sound', type: 'CheckButton' }), {
      text: '"Enable Sound"',
      button_pressed: 'true',
      disabled: 'true',
    });
    expect(p.text).toBe('Enable Sound');
    expect(p.buttonPressed).toBe(true);
    expect(p.disabled).toBe(true);
  });

  it('defaults button_pressed + disabled to false and leaves text undefined when absent', () => {
    const p = parseCheckButton(h({ name: 'Sound', type: 'CheckButton' }), {});
    expect(p.buttonPressed).toBe(false);
    expect(p.disabled).toBe(false);
    expect(p.text).toBeUndefined();
  });

  it('an unrecognised button_pressed value falls back to false, same as Button\'s own boolean slots', () => {
    const p = parseCheckButton(h({ name: 'Sound', type: 'CheckButton' }), { button_pressed: 'maybe' });
    expect(p.buttonPressed).toBe(false);
  });
});
