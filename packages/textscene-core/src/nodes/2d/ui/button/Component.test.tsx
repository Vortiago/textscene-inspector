/**
 * <Button> chrome contract: the default button box applies only when NO
 * `theme_override_styles/normal` box resolves. A box that resolves replaces the
 * chrome outright — including one that paints nothing.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './Component';
import { parseButton } from './parser';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import type { TscnInternalResource, TscnNode } from '../../../../parser/types';

// Godot's button `normal` stylebox fill (style_normal_color, translucent).
const DEFAULT_CHROME = 'rgba(26, 26, 26, 0.6)';
const heading = { type: 'node', attributes: { type: 'Button', name: 'B' } };

function node(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'B',
    type: 'Button',
    children: [],
    properties: parseButton(heading, { text: '"Go"', ...raw }),
  };
}

function renderButton(
  raw: Record<string, string> = {},
  internalResources: TscnInternalResource[] = []
): HTMLElement {
  const { container } = render(
    <SceneResourcesProvider internalResources={internalResources}>
      <Button node={node(raw)} />
    </SceneResourcesProvider>
  );
  return container.querySelector('[data-control-type="Button"]') as HTMLElement;
}

const box = (type: string, data: Record<string, string>): TscnInternalResource[] => [
  { id: 'SB', type, data },
];
const OVERRIDE = { 'theme_override_styles/normal': 'SubResource("SB")' };

describe('<Button> StyleBox chrome', () => {
  it('wears the default chrome when no normal box is themed', () => {
    expect(renderButton().style.backgroundColor).toBe(DEFAULT_CHROME);
  });

  it('keeps the default chrome when the normal ref cannot resolve', () => {
    expect(renderButton(OVERRIDE).style.backgroundColor).toBe(DEFAULT_CHROME);
  });

  it('wears a resolved StyleBoxFlat instead of the default chrome', () => {
    const div = renderButton(OVERRIDE, box('StyleBoxFlat', { bg_color: 'Color(0, 1, 0, 1)' }));
    expect(div.style.backgroundColor).toBe('rgba(0, 255, 0, 1)');
  });

  it('wears no chrome at all when the resolved box is a StyleBoxEmpty', () => {
    // StyleBoxEmpty::draw (style_box.h:80) is empty — the default chrome must
    // not show through a box that resolved.
    expect(renderButton(OVERRIDE, box('StyleBoxEmpty', {})).style.backgroundColor).toBe(
      'transparent'
    );
  });

  it('wears no fill when the resolved box draws neither centre, border nor shadow', () => {
    // StyleBoxFlat::draw (style_box_flat.cpp:455-460) returns early there.
    const div = renderButton(
      OVERRIDE,
      box('StyleBoxFlat', { bg_color: 'Color(1, 0, 0, 1)', draw_center: 'false' })
    );
    expect(div.style.backgroundColor).toBe('transparent');
  });

  it('paints no chrome for a flat button, themed or not', () => {
    // `if (!flat) { style->draw(...) }` — a flat Button draws text only.
    expect(renderButton({ flat: 'true' }).style.backgroundColor).toBe('');
  });
});
