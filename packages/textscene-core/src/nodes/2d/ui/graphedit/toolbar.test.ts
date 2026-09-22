/**
 * `toolbar.ts` vs the `menu_panel`/`menu_hbox` assembly GraphEdit's own
 * constructor builds (`scene/gui/graph_edit.cpp:3229-3324`) and the six
 * `show_*` setters that hide parts of it (`:2812-2870`).
 *
 * Every expected number is worked through Godot's own arithmetic by hand at
 * theme scale 1, against the fake measurer below — never read back off this
 * module.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { graphEditToolbar, GRAPH_EDIT_MENU_POSITION, zoomLabelText } from './toolbar';
import type { ToolbarTextMetrics } from './toolbar';
import type { GraphEditProperties } from './types';

function props(p: Partial<GraphEditProperties> = {}): GraphEditProperties {
  return { name: 'G', connections: [], ...p } as GraphEditProperties;
}

/** 8px per character, an 18px run height and a 19px font line pitch — round numbers so every expectation below is arithmetic, not measurement. */
const metrics: ToolbarTextMetrics = {
  measure: (text) => ({ x: text.length * 8, y: 18 }),
  fontHeightPx: 19,
};

const theme = nativeTheme(1);

function idsOf(p: Partial<GraphEditProperties>): string[] {
  return (graphEditToolbar(props(p), theme, metrics)?.items ?? []).map((i) => i.id);
}

describe('zoomLabelText (GraphEdit::_update_zoom_label, graph_edit.cpp:2620-2624)', () => {
  it('rounds zoom * 100 to a whole percent', () => {
    expect(zoomLabelText(1)).toBe('100%');
    expect(zoomLabelText(1.5)).toBe('150%');
    expect(zoomLabelText(0.2326)).toBe('23%');
  });
});

describe('graphEditToolbar item set (graph_edit.cpp:2812-2870)', () => {
  it('shows the zoom, grid, minimap and arrange controls by default, and no zoom label', () => {
    // graph_edit.h:191-196 — every show_* but show_zoom_label defaults true.
    expect(idsOf({})).toEqual([
      'zoom_minus',
      'zoom_reset',
      'zoom_plus',
      'toggle_grid',
      'toggle_snapping',
      'snapping_distance',
      'minimap',
      'arrange',
    ]);
  });

  it('adds the zoom label at the head when show_zoom_label is set (:2821-2824)', () => {
    expect(idsOf({ showZoomLabel: true })[0]).toBe('zoom_label');
  });

  it('drops all three zoom buttons together (:2830-2836)', () => {
    expect(idsOf({ showZoomButtons: false })).toEqual([
      'toggle_grid',
      'toggle_snapping',
      'snapping_distance',
      'minimap',
      'arrange',
    ]);
  });

  it('drops both grid toggles AND the snapping spinbox together (:2842-2848)', () => {
    expect(idsOf({ showGridButtons: false })).toEqual(['zoom_minus', 'zoom_reset', 'zoom_plus', 'minimap', 'arrange']);
  });

  it('drops only its own button for show_minimap_button (:2854-2857) and show_arrange_button (:2863-2866)', () => {
    expect(idsOf({ showMinimapButton: false })).not.toContain('minimap');
    expect(idsOf({ showMinimapButton: false })).toContain('arrange');
    expect(idsOf({ showArrangeButton: false })).not.toContain('arrange');
    expect(idsOf({ showArrangeButton: false })).toContain('minimap');
  });

  it('draws nothing at all when show_menu is false (:2812-2815)', () => {
    expect(graphEditToolbar(props({ showMenu: false }), theme, metrics)).toBeNull();
  });

  it('still draws the bare panel when show_menu is true and every item is hidden', () => {
    const bar = graphEditToolbar(
      props({ showZoomButtons: false, showGridButtons: false, showMinimapButton: false, showArrangeButton: false }),
      theme,
      metrics
    );
    // An empty HBoxContainer has a zero minimum size, so the panel is exactly
    // graph_toolbar_style's own margins: (4+4, 2+2) at scale 1.
    expect(bar?.items).toEqual([]);
    expect(bar?.panelRect).toEqual({ x: 10, y: 10, w: 8, h: 4 });
  });
});

describe('graphEditToolbar geometry (PanelContainer + HBoxContainer at scale 1)', () => {
  const bar = graphEditToolbar(props({ showZoomLabel: true }), theme, metrics)!;

  it('sits at the constructor\'s own hardcoded (10, 10) (graph_edit.cpp:3232)', () => {
    expect(GRAPH_EDIT_MENU_POSITION).toEqual({ x: 10, y: 10 });
    expect(bar.panelRect.x).toBe(10);
    expect(bar.panelRect.y).toBe(10);
  });

  it('sizes the panel to the hbox minimum plus graph_toolbar_style\'s (4,2,4,2) margins', () => {
    // Icon-only FlatButton: 2*4 margin + a 16px icon = 24x24 (button.cpp:481-526,
    // default_theme.cpp:360-362). SpinBox: 8 + 4*8 em + an 18px buttons block
    // wide, 8 + 19 tall (spin_box.cpp:82-86, line_edit.cpp:2443-2477).
    // Label: max(4*8, 48) wide, max(18, 19) tall (label.cpp:973-997 + the
    // 48*base_scale custom minimum, graph_edit.cpp:836).
    // 48 + 7*24 + 58 = 274, plus 8 separations of 4 = 306; tallest is 27.
    expect(bar.panelRect.w).toBe(306 + 8);
    expect(bar.panelRect.h).toBe(27 + 4);
  });

  it('lays the row out left to right with one separation between neighbours', () => {
    const xs = bar.items.map((i) => i.rect.x);
    // Content starts at the panel's own left margin, 4.
    expect(xs).toEqual([4, 56, 84, 112, 140, 168, 196, 258, 286]);
  });

  it('stretches every SIZE_FILL item to the row height and shrink-centres the label (graph_edit.cpp:3240)', () => {
    const label = bar.items.find((i) => i.id === 'zoom_label')!;
    const button = bar.items.find((i) => i.id === 'zoom_plus')!;
    expect(label.rect.h).toBe(19);
    expect(label.rect.y).toBe(2 + (27 - 19) / 2);
    expect(button.rect.h).toBe(27);
    expect(button.rect.y).toBe(2);
  });
});

describe('graphEditToolbar toggle states', () => {
  function pressed(p: Partial<GraphEditProperties>, id: string): boolean {
    return graphEditToolbar(props(p), theme, metrics)!.items.find((i) => i.id === id)!.pressed;
  }

  it('presses toggle_grid with show_grid (graph_edit.cpp:2735) — on by default', () => {
    expect(pressed({}, 'toggle_grid')).toBe(true);
    expect(pressed({ showGrid: false }, 'toggle_grid')).toBe(false);
  });

  it('presses toggle_snapping with snapping_enabled (graph_edit.cpp:2709) — on by default', () => {
    expect(pressed({}, 'toggle_snapping')).toBe(true);
    expect(pressed({ snappingEnabled: false }, 'toggle_snapping')).toBe(false);
  });

  it('presses the minimap button with minimap_enabled, which show_grid never reaches (graph_edit.cpp:2799-2810)', () => {
    expect(pressed({}, 'minimap')).toBe(true);
    expect(pressed({ showGrid: false }, 'minimap')).toBe(true);
    expect(pressed({ minimapEnabled: false }, 'minimap')).toBe(false);
  });

  it('never presses the arrange button — it has no toggle mode (graph_edit.cpp:3316-3322)', () => {
    expect(pressed({}, 'arrange')).toBe(false);
  });
});

describe('graphEditToolbar disabled states (graph_edit.cpp:2445-2446)', () => {
  function disabled(p: Partial<GraphEditProperties>, id: string): boolean {
    return graphEditToolbar(props(p), theme, metrics)!.items.find((i) => i.id === id)!.disabled;
  }

  it('leaves every button enabled while zoom sits between its bounds — the constructor sets no disabled flag', () => {
    expect(disabled({}, 'zoom_minus')).toBe(false);
    expect(disabled({}, 'zoom_plus')).toBe(false);
    expect(disabled({}, 'zoom_reset')).toBe(false);
  });

  it('disables the minus button once zoom has been parked on zoom_min', () => {
    expect(disabled({ zoomMinusDisabled: true }, 'zoom_minus')).toBe(true);
    expect(disabled({ zoomMinusDisabled: true }, 'zoom_plus')).toBe(false);
  });

  it('disables the plus button once zoom has been parked on zoom_max', () => {
    expect(disabled({ zoomPlusDisabled: true }, 'zoom_plus')).toBe(true);
    expect(disabled({ zoomPlusDisabled: true }, 'zoom_minus')).toBe(false);
  });

  it('never disables a button GraphEdit does not bind to a zoom bound', () => {
    const all = graphEditToolbar(props({ zoomMinusDisabled: true, zoomPlusDisabled: true }), theme, metrics)!.items;
    expect(all.filter((i) => i.disabled).map((i) => i.id)).toEqual(['zoom_minus', 'zoom_plus']);
  });
});
