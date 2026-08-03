/**
 * Render-level coverage for the 11 extended Control components fanned out on top of
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
    // No EXPAND children → every column is content-sized.
    expect(s.gridTemplateColumns).toBe('max-content max-content max-content');
    expect(s.columnGap).toBe('8px');
    expect(s.rowGap).toBe('6px');
  });

  it('GridContainer: defaults to a single column', () => {
    const c = renderOverlay([node('Grid', 'GridContainer', {})]);
    expect(styleOf(find(c, 'GridContainer')).gridTemplateColumns).toBe('max-content');
  });

  it('GridContainer: a column with an EXPAND child grows (1fr) (#30/#32)', () => {
    // 2 columns; child 1 (column index 1) has horizontal FILL|EXPAND (3).
    const c = renderOverlay([
      node('Grid', 'GridContainer', { columns: 2 }, [
        node('A', 'Label', { sizeFlagsHorizontal: 1 }),
        node('B', 'Label', { sizeFlagsHorizontal: 3 }),
      ]),
    ]);
    expect(styleOf(find(c, 'GridContainer')).gridTemplateColumns).toBe('max-content 1fr');
  });

  it('GridContainer: non-Control children do not occupy a column slot', () => {
    // A logic Node renders display:contents (no grid cell), so the EXPAND Label
    // must still land in column 1 — not be pushed to column 0 by the Node's index.
    const c = renderOverlay([
      node('Grid', 'GridContainer', { columns: 2 }, [
        node('A', 'Label', { sizeFlagsHorizontal: 1 }),
        node('Logic', 'Node', {}),
        node('B', 'Label', { sizeFlagsHorizontal: 3 }),
      ]),
    ]);
    expect(styleOf(find(c, 'GridContainer')).gridTemplateColumns).toBe('max-content 1fr');
  });

  it('ScrollContainer: scroll modes map to overflowX/Y (#31)', () => {
    // horizontal DISABLED (0) → hidden; vertical SHOW_ALWAYS (2) → scroll.
    const c = renderOverlay([
      node('Scroll', 'ScrollContainer', { horizontalScrollMode: 0, verticalScrollMode: 2 }),
    ]);
    const s = styleOf(find(c, 'ScrollContainer'));
    expect(s.overflowX).toBe('hidden');
    expect(s.overflowY).toBe('scroll');
  });

  it('ScrollContainer: defaults to auto on both axes', () => {
    const c = renderOverlay([node('Scroll', 'ScrollContainer', {})]);
    const s = styleOf(find(c, 'ScrollContainer'));
    expect(s.overflowX).toBe('auto');
    expect(s.overflowY).toBe('auto');
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

});

describe('Control components — StyleBox panels', () => {
  it('Panel: Godot default panel fill when un-themed', () => {
    const c = renderOverlay([node('P', 'Panel', {})]);
    expect(styleOf(find(c, 'Panel')).backgroundColor).toBe('rgba(26, 26, 26, 0.6)');
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
    expect(styleOf(pc).backgroundColor).toBe('rgba(26, 26, 26, 0.6)');
    // child renders inside, in-flow (block) → position relative, not absolute
    const inner = pc?.querySelector('[data-control-type="ColorRect"]');
    expect(inner).toBeTruthy();
    expect(styleOf(inner ?? null).position).toBe('relative');
  });
});

describe('Control components — leaf controls', () => {
  it('Button: renders text with default chrome + pointer cursor', () => {
    const c = renderOverlay([node('B', 'Button', { text: 'Click' })]);
    const b = find(c, 'Button');
    expect(b?.textContent).toBe('Click');
    expect(styleOf(b).backgroundColor).toBe('rgba(26, 26, 26, 0.6)');
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

  it('RichTextLabel: renders a BBCode subset when bbcode is enabled', () => {
    const c = renderOverlay([
      node('R', 'RichTextLabel', {
        text: '[b]Hello[/b] [color=red]world[/color]',
        bbcodeEnabled: true,
      }),
    ]);
    const rt = find(c, 'RichTextLabel');
    expect(rt?.textContent).toBe('Hello world');
    expect([...rt!.querySelectorAll('span')].some((s) => styleOf(s).fontWeight === 'bold')).toBe(true);
  });

  it('RichTextLabel: shows tags literally when bbcode is disabled', () => {
    const c = renderOverlay([node('R', 'RichTextLabel', { text: '[b]raw[/b]', bbcodeEnabled: false })]);
    expect(find(c, 'RichTextLabel')?.textContent).toBe('[b]raw[/b]');
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
    expect(styleOf(hud ?? null).position).toBe('absolute');
  });

  it('a hidden CanvasLayer NESTED under a visible root is display:none', () => {
    const c = renderOverlay([
      node('Root', 'Control', { anchorsPreset: 15 }, [
        node('Layer', 'CanvasLayer', { visible: false }),
      ]),
    ]);
    // Child visibility is respected (only the previewed ROOT is force-shown).
    expect(styleOf(find(c, 'CanvasLayer')).display).toBe('none');
  });

  it('a visible=false ROOT is shown anyway (preview shows what you opened)', () => {
    const c = renderOverlay([node('Dialog', 'PanelContainer', { visible: false })]);
    const root = find(c, 'PanelContainer');
    expect(root).toBeTruthy();
    expect(styleOf(root).display).not.toBe('none');
  });
});
