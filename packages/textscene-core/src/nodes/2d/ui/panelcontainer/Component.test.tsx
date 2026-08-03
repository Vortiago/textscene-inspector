/**
 * <PanelContainer> render contract: a default panel fill overridden by a
 * `theme_override_styles/panel` StyleBox, rendering as a flex column that hands
 * its child the 'margin' layout kind so the child fills (not just flows inside)
 * the box's content margins — the same single-child fit MarginContainer uses.
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

  it('keeps the default fill when the panel ref cannot resolve', () => {
    const div = renderBox({ 'theme_override_styles/panel': 'SubResource("Missing")' });
    expect(div.style.backgroundColor).toBe(DEFAULT_BACKGROUND);
  });

  it('paints nothing when the resolved box paints nothing', () => {
    // A resolved StyleBoxEmpty (style_box.h:80) or a centre-less StyleBoxFlat
    // (style_box_flat.cpp:455-460) replaces the default box with nothing — the
    // default fill must not survive underneath it.
    const empty: TscnInternalResource = { id: 'SB', type: 'StyleBoxEmpty', data: {} };
    expect(
      renderBox({ 'theme_override_styles/panel': 'SubResource("SB")' }, [empty]).style
        .backgroundColor
    ).toBe('transparent');

    const noCentre: TscnInternalResource = {
      id: 'SB2',
      type: 'StyleBoxFlat',
      data: { bg_color: 'Color(1, 0, 0, 1)', draw_center: 'false' },
    };
    expect(
      renderBox({ 'theme_override_styles/panel': 'SubResource("SB2")' }, [noCentre]).style
        .backgroundColor
    ).toBe('transparent');
  });

  it('provides the margin layout kind to its subtree, so the child fills the box', () => {
    const { getByTestId } = render(
      <SceneResourcesProvider>
        <PanelContainer node={node()}>
          <KindProbe />
        </PanelContainer>
      </SceneResourcesProvider>
    );
    expect(getByTestId('kind').textContent).toBe('margin');
  });

  it('renders a flex column so the single child can fill the content height', () => {
    const div = renderBox();
    expect(div.style.display).toBe('flex');
    expect(div.style.flexDirection).toBe('column');
  });
});
