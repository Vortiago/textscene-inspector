/**
 * <CanvasLayer> render contract: a full-rect absolute passthrough layer that
 * hosts Control children and provides the 'free' layout kind. Not a Control
 * itself, so no anchors/offsets — it just fills the overlay.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CanvasLayer } from './Component';
import { parseCanvasLayer } from './parser';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'CanvasLayer', name: 'HUD' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'HUD', type: 'CanvasLayer', children: [], properties: parseCanvasLayer(heading, raw) };
}

function KindProbe() {
  return <span data-testid="kind">{useControlParent()}</span>;
}

function renderLayer(raw: Record<string, string> = {}) {
  const { container } = render(<CanvasLayer node={node(raw)} />);
  return container.querySelector('[data-control-type="CanvasLayer"]') as HTMLElement;
}

describe('<CanvasLayer>', () => {
  it('fills the overlay as an absolutely-positioned full rect', () => {
    const div = renderLayer();
    expect(div.style.position).toBe('absolute');
    expect(div.style.inset).toBe('0'); // inset: 0 → full-rect overlay
  });

  it('is visible by default and hides when visible = false', () => {
    expect(renderLayer().style.display).toBe('');
    expect(renderLayer({ visible: 'false' }).style.display).toBe('none');
  });

  it('provides the free layout kind to its Control children', () => {
    const { getByTestId } = render(
      <CanvasLayer node={node()}>
        <KindProbe />
      </CanvasLayer>
    );
    expect(getByTestId('kind').textContent).toBe('free');
  });
});
