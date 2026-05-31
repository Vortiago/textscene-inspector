/**
 * Render-level coverage for the 11 ld-58 Control components fanned out on top of
 * the base 4 (Control/VBox/Label/ColorRect, covered in ControlDispatcher.test).
 * Each test mounts the component through <ControlOverlay> (so it runs under the
 * real SceneResources + ControlParent contexts) and asserts its signature CSS or
 * content. Parsing is covered by each slice's own parser.test.ts; here we feed
 * already-parsed ControlProperties to exercise the DOM components.
 */

import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import type { TscnInternalResource, TscnNode } from '../../parser/types';
import { ControlOverlay } from './index';

function node(
  name: string,
  type: string,
  properties: object,
  children: TscnNode[] = []
): TscnNode {
  return { name, type, children, properties: { name, ...properties } } as TscnNode;
}

function renderOverlay(
  nodes: TscnNode[],
  internalResources: TscnInternalResource[] = []
): HTMLElement {
  return render(
    <ControlOverlay nodes={nodes} internalResources={internalResources} />
  ).container;
}

function find(container: HTMLElement, type: string): HTMLElement | null {
  return container.querySelector(`[data-control-type="${type}"]`);
}
function styleOf(el: Element | null): CSSStyleDeclaration {
  return (el as HTMLElement).style;
}

const styleBoxFlat = (id: string, bg: string): TscnInternalResource => ({
  id,
  type: 'StyleBoxFlat',
  data: { id, bg_color: bg },
});

describe('Control components — containers', () => {
  it('HBoxContainer: flex row with separation → gap', () => {
    const c = renderOverlay([
      node('Row', 'HBoxContainer', { themeOverrideConstants: { separation: 10 } }),
    ]);
    const s = styleOf(find(c, 'HBoxContainer'));
    expect(s.display).toBe('flex');
    expect(s.flexDirection).toBe('row');
    expect(s.gap).toBe('10px');
  });

  it('HBoxContainer: default separation 4 when no override', () => {
    const c = renderOverlay([node('Row', 'HBoxContainer', {})]);
    expect(styleOf(find(c, 'HBoxContainer')).gap).toBe('4px');
  });

  it('GridContainer: grid with columns + h/v separation → gaps', () => {
    const c = renderOverlay([
      node('Grid', 'GridContainer', {
        columns: 3,
        themeOverrideConstants: { h_separation: 8, v_separation: 6 },
      }),
    ]);
    const s = styleOf(find(c, 'GridContainer'));
    expect(s.display).toBe('grid');
    expect(s.gridTemplateColumns).toBe('repeat(3, max-content)');
    expect(s.columnGap).toBe('8px');
    expect(s.rowGap).toBe('6px');
  });

  it('GridContainer: defaults to a single column', () => {
    const c = renderOverlay([node('Grid', 'GridContainer', {})]);
    expect(styleOf(find(c, 'GridContainer')).gridTemplateColumns).toBe('repeat(1, max-content)');
  });

  it('CenterContainer: flex centered on both axes', () => {
    const c = renderOverlay([node('Center', 'CenterContainer', {})]);
    const s = styleOf(find(c, 'CenterContainer'));
    expect(s.display).toBe('flex');
    expect(s.alignItems).toBe('center');
    expect(s.justifyContent).toBe('center');
  });

  it('MarginContainer: margins → padding (top right bottom left)', () => {
    const c = renderOverlay([
      node('M', 'MarginContainer', {
        themeOverrideConstants: { margin_left: 4, margin_top: 8, margin_right: 12, margin_bottom: 16 },
      }),
    ]);
    expect(styleOf(find(c, 'MarginContainer')).padding).toBe('8px 12px 16px 4px');
  });

  it('ScrollContainer: overflow auto', () => {
    const c = renderOverlay([node('S', 'ScrollContainer', {})]);
    expect(styleOf(find(c, 'ScrollContainer')).overflow).toBe('auto');
  });
});

describe('Control components — StyleBox panels', () => {
  it('Panel: neutral default background when un-themed', () => {
    const c = renderOverlay([node('P', 'Panel', {})]);
    expect(styleOf(find(c, 'Panel')).backgroundColor).toBe('rgba(42, 42, 46, 0.92)');
  });

  it('Panel: resolves theme_override_styles/panel StyleBox background', () => {
    const c = renderOverlay(
      [node('P', 'Panel', { themeOverrideStyles: { panel: 'SubResource("SB")' } })],
      [styleBoxFlat('SB', 'Color(0, 0.5, 1, 1)')]
    );
    expect(styleOf(find(c, 'Panel')).backgroundColor).toBe('rgba(0, 128, 255, 1)');
  });

  it('PanelContainer: default panel fill + provides block layout to children', () => {
    const c = renderOverlay([
      node('PC', 'PanelContainer', {}, [node('Inner', 'ColorRect', { color: 'Color(1, 0, 0, 1)' })]),
    ]);
    const pc = find(c, 'PanelContainer');
    expect(styleOf(pc).backgroundColor).toBe('rgba(42, 42, 46, 0.92)');
    // child renders inside, in-flow (block) → position relative, not absolute
    const inner = pc?.querySelector('[data-control-type="ColorRect"]');
    expect(inner).toBeTruthy();
    expect(styleOf(inner).position).toBe('relative');
  });
});

describe('Control components — leaf controls', () => {
  it('Button: renders text with default chrome + pointer cursor', () => {
    const c = renderOverlay([node('B', 'Button', { text: 'Click' })]);
    const b = find(c, 'Button');
    expect(b?.textContent).toBe('Click');
    expect(styleOf(b).backgroundColor).toBe('rgba(70, 78, 94, 0.95)');
    expect(styleOf(b).cursor).toBe('pointer');
  });

  it('Button: disabled → dimmed + default cursor', () => {
    const c = renderOverlay([node('B', 'Button', { text: 'X', disabled: true })]);
    const s = styleOf(find(c, 'Button'));
    expect(s.opacity).toBe('0.6');
    expect(s.cursor).toBe('default');
  });

  it('Button: theme StyleBox replaces the default chrome', () => {
    const c = renderOverlay(
      [node('B', 'Button', { text: 'Go', themeOverrideStyles: { normal: 'SubResource("BN")' } })],
      [styleBoxFlat('BN', 'Color(1, 0, 0, 1)')]
    );
    expect(styleOf(find(c, 'Button')).backgroundColor).toBe('rgba(255, 0, 0, 1)');
  });

  it('RichTextLabel: strips BBCode to plain text', () => {
    const c = renderOverlay([node('R', 'RichTextLabel', { text: '[b]Hello[/b] [color=red]world[/color]' })]);
    expect(find(c, 'RichTextLabel')?.textContent).toBe('Hello world');
  });

  it('TextureRect: falls back to a placeholder outside a ResourceLoader', () => {
    const c = renderOverlay([node('T', 'TextureRect', { texture: 'res://art/icon.png' })]);
    const t = find(c, 'TextureRect');
    expect(t).toBeTruthy();
    expect(t?.getAttribute('data-control-fallback')).toBe('true');
    expect(styleOf(t).outline).toContain('dashed');
  });
});

describe('Control components — CanvasLayer passthrough', () => {
  it('fills the overlay and lets its Control children anchor freely', () => {
    const c = renderOverlay([
      node('Layer', 'CanvasLayer', { visible: true }, [
        node('HUD', 'Control', { anchorsPreset: 15 }),
      ]),
    ]);
    const layer = find(c, 'CanvasLayer');
    expect(styleOf(layer).position).toBe('absolute');
    // child Control is anchored (free regime) → absolute
    const hud = layer?.querySelector('[data-control-type="Control"]');
    expect(styleOf(hud).position).toBe('absolute');
  });

  it('hidden CanvasLayer is display:none', () => {
    const c = renderOverlay([node('Layer', 'CanvasLayer', { visible: false })]);
    expect(styleOf(find(c, 'CanvasLayer')).display).toBe('none');
  });
});
