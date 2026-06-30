/**
 * OptionButton render contract — DOM-overlay widget (ADR-0003): a collapsed
 * dropdown affordance that shows the SELECTED item's text (not all items, not
 * the first item). Distinguishing: selecting index 2 shows "Hard" and must NOT
 * also show "Easy".
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { OptionButton } from './Component';
import { parseOptionButton } from './parser';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'OptionButton', name: 'O' } };
const ITEMS = {
  item_count: '3',
  'popup/item_0/text': '"Easy"',
  'popup/item_0/id': '0',
  'popup/item_1/text': '"Normal"',
  'popup/item_1/id': '1',
  'popup/item_2/text': '"Hard"',
  'popup/item_2/id': '2',
};
function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'O', type: 'OptionButton', children: [], properties: parseOptionButton(heading, raw) };
}

describe('OptionButton render contract', () => {
  it("displays the SELECTED item's text and not the unselected ones", () => {
    const { container } = render(<OptionButton node={node({ ...ITEMS, selected: '2' })} />);
    expect(container.textContent).toContain('Hard');
    expect(container.textContent).not.toContain('Easy');
  });

  it('tracks a different selected index', () => {
    const { container } = render(<OptionButton node={node({ ...ITEMS, selected: '0' })} />);
    expect(container.textContent).toContain('Easy');
    expect(container.textContent).not.toContain('Hard');
  });

  it('renders empty when selected is out of range (a pinned fallback, not a crash)', () => {
    const { container } = render(<OptionButton node={node({ ...ITEMS, selected: '5' })} />);
    expect(container.textContent).toBe('');
  });
});
