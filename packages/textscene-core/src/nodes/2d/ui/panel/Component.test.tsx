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

  it('provides the free layout kind to its subtree', () => {
    const { getByTestId } = render(
      <Panel node={node()}>
        <KindProbe />
      </Panel>
    );
    expect(getByTestId('kind').textContent).toBe('free');
  });
});
