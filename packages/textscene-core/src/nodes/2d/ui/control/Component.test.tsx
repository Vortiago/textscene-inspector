/**
 * <Control> render contract: the base UI node positions itself from its
 * anchors/offsets when free (top-level), becomes a flex item when its parent is
 * a container, hides on visible = false, and always resets the child layout kind
 * to 'free' (Control is not a container).
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Control } from './Component';
import { parseControl } from './parser';
import {
  useControlParent,
  ControlParentProvider,
} from '../../../../r3f/controls/ControlParentContext';
import type { TscnNode } from '../../../../parser/types';

const heading = { type: 'node', attributes: { type: 'Control', name: 'Panel' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Panel', type: 'Control', children: [], properties: parseControl(heading, raw) };
}

function KindProbe() {
  return <span data-testid="kind">{useControlParent()}</span>;
}

function renderControl(raw: Record<string, string> = {}) {
  const { container } = render(<Control node={node(raw)} />);
  return container.querySelector('[data-control-type="Control"]') as HTMLElement;
}

describe('<Control>', () => {
  it('absolutely positions itself from a full-rect anchors preset when free', () => {
    const div = renderControl({ anchors_preset: '15', anchor_right: '1.0', anchor_bottom: '1.0' });
    expect(div.style.position).toBe('absolute');
    expect(div.style.left).toBe('0px');
    expect(div.style.top).toBe('0px');
    expect(div.style.right).toBe('0px');
    expect(div.style.bottom).toBe('0px');
  });

  it('becomes a relatively-positioned flex item under a container parent', () => {
    const { container } = render(
      <ControlParentProvider kind="row">
        <Control node={node({ size_flags_horizontal: '3' })} />
      </ControlParentProvider>
    );
    const div = container.querySelector('[data-control-type="Control"]') as HTMLElement;
    expect(div.style.position).toBe('relative');
    expect(div.style.flexGrow).toBe('1'); // SIZE_FLAG_EXPAND (2) is set in bitmask 3
  });

  it('hides itself when visible = false', () => {
    expect(renderControl({ visible: 'false' }).style.display).toBe('none');
  });

  it('resets the child layout kind to free', () => {
    const { getByTestId } = render(
      <Control node={node()}>
        <KindProbe />
      </Control>
    );
    expect(getByTestId('kind').textContent).toBe('free');
  });
});
