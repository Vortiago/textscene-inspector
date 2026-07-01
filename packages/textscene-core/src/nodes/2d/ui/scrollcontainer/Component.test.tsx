/**
 * <ScrollContainer> render contract: maps Godot's per-axis ScrollMode to CSS
 * overflow (default AUTO scrolls only on overflow; DISABLED clips; SHOW_ALWAYS
 * always scrolls) and provides the 'block' layout kind to its subtree.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ScrollContainer } from './Component';
import { parseScrollContainer } from './parser';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'ScrollContainer', name: 'Scroll' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Scroll', type: 'ScrollContainer', children: [], properties: parseScrollContainer(heading, raw) };
}

function KindProbe() {
  return <span data-testid="kind">{useControlParent()}</span>;
}

function renderScroll(raw: Record<string, string> = {}) {
  const { container } = render(<ScrollContainer node={node(raw)} />);
  return container.querySelector('[data-control-type="ScrollContainer"]') as HTMLElement;
}

describe('<ScrollContainer>', () => {
  it('defaults both axes to auto overflow', () => {
    const div = renderScroll();
    expect(div.style.overflowX).toBe('auto');
    expect(div.style.overflowY).toBe('auto');
  });

  it('maps DISABLED (0) to hidden and SHOW_ALWAYS (2) to scroll per axis', () => {
    const div = renderScroll({ horizontal_scroll_mode: '0', vertical_scroll_mode: '2' });
    expect(div.style.overflowX).toBe('hidden');
    expect(div.style.overflowY).toBe('scroll');
  });

  it('provides the block layout kind to its subtree', () => {
    const { getByTestId } = render(
      <ScrollContainer node={node()}>
        <KindProbe />
      </ScrollContainer>
    );
    expect(getByTestId('kind').textContent).toBe('block');
  });
});
