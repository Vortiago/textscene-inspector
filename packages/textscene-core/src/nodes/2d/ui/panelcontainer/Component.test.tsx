/**
 * <PanelContainer> render contract: a default panel fill overridden by a
 * `theme_override_styles/panel` StyleBox, providing the 'block' layout kind so
 * its child flows inside the box's content margins.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PanelContainer } from './Component';
import { parsePanelContainer } from './parser';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';

// Godot's default PanelContainer `panel` stylebox fill (style_normal_color).
const DEFAULT_BACKGROUND = 'rgba(26, 26, 26, 0.6)';
const heading = { type: 'node', attributes: { type: 'PanelContainer', name: 'Box' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Box', type: 'PanelContainer', children: [], properties: parsePanelContainer(heading, raw) };
}

function KindProbe() {
  return <span data-testid="kind">{useControlParent()}</span>;
}

function renderBox(raw: Record<string, string> = {}, internalResources: TscnInternalResource[] = []) {
  const { container } = render(
    <SceneResourcesProvider internalResources={internalResources}>
      <PanelContainer node={node(raw)} />
    </SceneResourcesProvider>
  );
  return container.querySelector('[data-control-type="PanelContainer"]') as HTMLElement;
}

describe('<PanelContainer>', () => {
  it('applies the default panel fill when un-themed', () => {
    expect(renderBox().style.backgroundColor).toBe(DEFAULT_BACKGROUND);
  });

  it('lets a resolved StyleBox override the default background', () => {
    const styleBox: TscnInternalResource = {
      id: 'SB',
      type: 'StyleBoxFlat',
      data: { bg_color: 'Color(0, 1, 0, 1)' },
    };
    const div = renderBox({ 'theme_override_styles/panel': 'SubResource("SB")' }, [styleBox]);
    expect(div.style.backgroundColor).toBe('rgba(0, 255, 0, 1)');
  });

  it('provides the block layout kind to its subtree', () => {
    const { getByTestId } = render(
      <SceneResourcesProvider>
        <PanelContainer node={node()}>
          <KindProbe />
        </PanelContainer>
      </SceneResourcesProvider>
    );
    expect(getByTestId('kind').textContent).toBe('block');
  });
});
