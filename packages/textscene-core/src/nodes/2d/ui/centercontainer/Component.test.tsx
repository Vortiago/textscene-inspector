/**
 * <CenterContainer> render contract: a flex box that centres its single child
 * on both axes and provides the 'center' layout kind to its subtree.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CenterContainer } from './Component';
import { parseCenterContainer } from './parser';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'CenterContainer', name: 'Center' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Center', type: 'CenterContainer', children: [], properties: parseCenterContainer(heading, raw) };
}

function KindProbe() {
  return <span data-testid="kind">{useControlParent()}</span>;
}

describe('<CenterContainer>', () => {
  it('centres its child on both axes via flex', () => {
    const { container } = render(<CenterContainer node={node()} />);
    const div = container.querySelector('[data-control-type="CenterContainer"]') as HTMLElement;
    expect(div.style.display).toBe('flex');
    expect(div.style.alignItems).toBe('center');
    expect(div.style.justifyContent).toBe('center');
  });

  it('provides the center layout kind to its subtree', () => {
    const { getByTestId } = render(
      <CenterContainer node={node()}>
        <KindProbe />
      </CenterContainer>
    );
    expect(getByTestId('kind').textContent).toBe('center');
  });
});
