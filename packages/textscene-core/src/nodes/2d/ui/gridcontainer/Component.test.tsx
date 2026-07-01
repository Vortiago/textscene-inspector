/**
 * <GridContainer> render contract: N-column CSS grid with content-sized columns
 * by default, `h_/v_separation` → column/row gaps (default 4px), and the 'grid'
 * layout kind. Column EXPAND sizing + hidden-child placement (which need the
 * live registry / selection) are covered by ControlDispatcher tests.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { GridContainer } from './Component';
import { parseGridContainer } from './parser';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'GridContainer', name: 'Grid' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Grid', type: 'GridContainer', children: [], properties: parseGridContainer(heading, raw) };
}

function KindProbe() {
  return <span data-testid="kind">{useControlParent()}</span>;
}

function renderGrid(raw: Record<string, string> = {}) {
  const { container } = render(<GridContainer node={node(raw)} />);
  return container.querySelector('[data-control-type="GridContainer"]') as HTMLElement;
}

describe('<GridContainer>', () => {
  it('lays out as a grid with one content-sized track per column', () => {
    const div = renderGrid({ columns: '3' });
    expect(div.style.display).toBe('grid');
    expect(div.style.gridTemplateColumns).toBe('max-content max-content max-content');
  });

  it('defaults both gaps to 4px and maps h_/v_separation overrides', () => {
    const def = renderGrid({ columns: '2' });
    expect(def.style.columnGap).toBe('4px');
    expect(def.style.rowGap).toBe('4px');
    const over = renderGrid({
      columns: '2',
      'theme_override_constants/h_separation': '10',
      'theme_override_constants/v_separation': '6',
    });
    expect(over.style.columnGap).toBe('10px');
    expect(over.style.rowGap).toBe('6px');
  });

  it('provides the grid layout kind to its subtree', () => {
    const { getByTestId } = render(
      <GridContainer node={node({ columns: '2' })}>
        <KindProbe />
      </GridContainer>
    );
    expect(getByTestId('kind').textContent).toBe('grid');
  });
});
