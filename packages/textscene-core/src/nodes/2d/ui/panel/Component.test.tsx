/**
 * <Panel> render contract: paints its `theme_override_styles/panel` StyleBox as
 * a background, falls back to a neutral fill when un-themed or the ref can't
 * resolve, and provides the 'free' layout kind (children anchor against it).
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Panel } from './Component';
import { parsePanel } from './parser';
import { useControlParent } from '../../../../r3f/controls/ControlParentContext';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';

// Godot's default Panel `panel` stylebox fill (style_normal_color, translucent).
const DEFAULT_BACKGROUND = 'rgba(26, 26, 26, 0.6)';
const heading = { type: 'node', attributes: { type: 'Panel', name: 'Panel' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return { name: 'Panel', type: 'Panel', children: [], properties: parsePanel(heading, raw) };
}

function KindProbe() {
  return <span data-testid="kind">{useControlParent()}</span>;
}

function renderPanel(raw: Record<string, string> = {}, internalResources: TscnInternalResource[] = []) {
  const { container } = render(
    <SceneResourcesProvider internalResources={internalResources}>
      <Panel node={node(raw)} />
    </SceneResourcesProvider>
  );
  return container.querySelector('[data-control-type="Panel"]') as HTMLElement;
}

describe('<Panel>', () => {
  it('falls back to a neutral background when un-themed', () => {
    expect(renderPanel().style.backgroundColor).toBe(DEFAULT_BACKGROUND);
  });

  it('paints the StyleBox bg_color when a panel override resolves', () => {
    const styleBox: TscnInternalResource = {
      id: 'SB',
      type: 'StyleBoxFlat',
      data: { bg_color: 'Color(1, 0, 0, 1)' },
    };
    const div = renderPanel({ 'theme_override_styles/panel': 'SubResource("SB")' }, [styleBox]);
    expect(div.style.backgroundColor).toBe('rgba(255, 0, 0, 1)');
  });

  it('degrades to the neutral background when the panel ref cannot resolve', () => {
    const div = renderPanel({ 'theme_override_styles/panel': 'SubResource("Missing")' });
    expect(div.style.backgroundColor).toBe(DEFAULT_BACKGROUND);
  });

  it('paints nothing when the resolved box is a StyleBoxEmpty', () => {
    // StyleBoxEmpty::draw (style_box.h:80) is empty: an override that resolves
    // to one replaces the default panel box with nothing, so the neutral fill
    // must NOT show through.
    const styleBox: TscnInternalResource = { id: 'SB', type: 'StyleBoxEmpty', data: {} };
    const div = renderPanel({ 'theme_override_styles/panel': 'SubResource("SB")' }, [styleBox]);
    expect(div.style.backgroundColor).toBe('transparent');
  });

  it('paints nothing when the resolved box draws neither centre, border nor shadow', () => {
    // StyleBoxFlat::draw (style_box_flat.cpp:455-460) returns before drawing
    // anything in that case.
    const styleBox: TscnInternalResource = {
      id: 'SB',
      type: 'StyleBoxFlat',
      data: { bg_color: 'Color(1, 0, 0, 1)', draw_center: 'false' },
    };
    const div = renderPanel({ 'theme_override_styles/panel': 'SubResource("SB")' }, [styleBox]);
    expect(div.style.backgroundColor).toBe('transparent');
  });

  it('keeps the border of a border-only box without its default fill', () => {
    const styleBox: TscnInternalResource = {
      id: 'SB',
      type: 'StyleBoxFlat',
      data: { draw_center: 'false', border_width_left: '8', border_color: 'Color(0, 0, 1, 1)' },
    };
    const div = renderPanel({ 'theme_override_styles/panel': 'SubResource("SB")' }, [styleBox]);
    expect(div.style.backgroundColor).toBe('transparent');
    expect(div.style.borderColor).toBe('rgba(0, 0, 255, 1)');
  });

  it('provides the free layout kind to its subtree', () => {
    const { getByTestId } = render(
      <Panel node={node()}>
        <KindProbe />
      </Panel>
    );
    expect(getByTestId('kind').textContent).toBe('free');
  });
});
