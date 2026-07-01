/**
 * <MarginContainer> render contract: maps the four
 * `theme_override_constants/margin_*` to CSS padding (top right bottom left) and
 * provides the 'margin' layout kind so its single child fills the padded box.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { MarginContainer } from './Component';
import { parseMarginContainer } from './parser';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'MarginContainer', name: 'Margins' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Margins', type: 'MarginContainer', children: [], properties: parseMarginContainer(heading, raw) };
}

function KindProbe() {
  return <span data-testid="kind">{useControlParent()}</span>;
}

function renderMargins(raw: Record<string, string> = {}) {
  const { container } = render(<MarginContainer node={node(raw)} />);
  return container.querySelector('[data-control-type="MarginContainer"]') as HTMLElement;
}

describe('<MarginContainer>', () => {
  it('maps margin_* constants to CSS padding (top right bottom left)', () => {
    const div = renderMargins({
      'theme_override_constants/margin_top': '12',
      'theme_override_constants/margin_right': '16',
      'theme_override_constants/margin_bottom': '20',
      'theme_override_constants/margin_left': '8',
    });
    expect(div.style.display).toBe('flex');
    expect(div.style.flexDirection).toBe('column');
    expect(div.style.padding).toBe('12px 16px 20px 8px');
  });

  it('still emits explicit zero padding when no margins are set', () => {
    // The four 0px sides collapse to the '0px' shorthand — the padding is applied.
    expect(renderMargins().style.padding).toBe('0px');
  });

  it('provides the margin layout kind to its subtree', () => {
    const { getByTestId } = render(
      <MarginContainer node={node()}>
        <KindProbe />
      </MarginContainer>
    );
    expect(getByTestId('kind').textContent).toBe('margin');
  });
});
