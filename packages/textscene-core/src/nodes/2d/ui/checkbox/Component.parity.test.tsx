/**
 * CheckBox render contract — DOM-overlay widget (ADR-0003): shows its label text
 * and reflects the checked state (`button_pressed`) via a stable `data-checked`
 * attribute so the contract does not pin a particular glyph/visual.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CheckBox } from './Component';
import { parseCheckBox } from './parser';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'CheckBox', name: 'C' } };
function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'C', type: 'CheckBox', children: [], properties: parseCheckBox(heading, raw) };
}

describe('CheckBox render contract', () => {
  it('shows the label text', () => {
    const { container } = render(<CheckBox node={node({ text: '"Fullscreen"' })} />);
    expect(container.textContent).toContain('Fullscreen');
  });

  it('reflects the checked state via data-checked (true when pressed, false otherwise)', () => {
    const on = render(<CheckBox node={node({ text: '"On"', button_pressed: 'true' })} />);
    expect((on.container.firstChild as HTMLElement).getAttribute('data-checked')).toBe('true');

    const off = render(<CheckBox node={node({ text: '"Off"' })} />);
    expect((off.container.firstChild as HTMLElement).getAttribute('data-checked')).toBe('false');
  });
});
