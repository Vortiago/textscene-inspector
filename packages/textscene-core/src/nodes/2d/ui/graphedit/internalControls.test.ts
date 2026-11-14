/** The toolbar a GraphEdit builds (`graph_edit.cpp:3229-3321`), what it sets on each Control, and where it sits. */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { internalBackSlotOf, internalControlsOf } from '../../../../r3f/controls/native/internalControls';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import { canvasSubOrders, wholeKeySlot } from '../../../../r3f/canvasItemState';
import type { ButtonProperties } from '../button/types';
import type { SpinBoxProperties } from '../spinbox/types';
import type { LabelProperties } from '../label/types';
import type { GraphEditProperties } from './types';
import '../../../../parser/TscnParser';
import '../../../../r3f/controls/index';

const THEME = nativeTheme(1);

function graphEdit(props: Partial<Record<keyof GraphEditProperties, unknown>> = {}, rtl = false): SolveNode {
  return withThemeItems({
    ...solveNode(),
    path: 'G',
    rtl,
    node: controlNode('G', 'GraphEdit', { name: 'G', minimapEnabled: false, ...props }),
  });
}

function menuPanel(n: SolveNode): SolveNode {
  const [panel, ...rest] = internalControlsOf(n, THEME);
  expect(rest).toEqual([]);
  expect(panel!.mode).toBe('back');
  return panel!.node;
}

/** The Control called `name` in `menu_hbox`. */
function item(n: SolveNode, name: string): SolveNode {
  const found = menuPanel(n).children[0]!.children.find((c) => c.node.name === name);
  if (!found) throw new Error(`expected a Control called ${name} in menu_hbox, found none`);
  return found;
}

const propsOf = <P>(n: SolveNode) => n.node.properties as P;
const isShown = (n: SolveNode) => propsOf<{ visible?: boolean }>(n).visible !== false;

const ROW = [
  'zoom_label',
  'zoom_minus_button',
  'zoom_reset_button',
  'zoom_plus_button',
  'toggle_grid_button',
  'toggle_snapping_button',
  'snapping_distance_spinbox',
  'minimap_button',
  'arrange_button',
];

describe('the toolbar a GraphEdit builds', () => {
  it('adds menu_panel, a PanelContainer holding menu_hbox with the row in child order (:3229-3321)', () => {
    const panel = menuPanel(graphEdit());
    expect(panel.node.type).toBe('PanelContainer');
    expect(panel.path).toBe('G/@menu_panel');
    const hbox = panel.children[0]!;
    expect(hbox.node.type).toBe('HBoxContainer');
    expect(hbox.children.map((c) => c.node.name)).toEqual(ROW);
  });

  it('gives each Control its class: a Label, FlatButtons and a SpinBox', () => {
    const types = menuPanel(graphEdit()).children[0]!.children.map((c) => c.node.type);
    expect(types).toEqual([
      'Label',
      'Button',
      'Button',
      'Button',
      'Button',
      'Button',
      'SpinBox',
      'Button',
      'Button',
    ]);
    for (const name of ROW.filter((n) => n.endsWith('_button'))) {
      expect(propsOf<ButtonProperties>(item(graphEdit(), name)).themeTypeVariation).toBe('FlatButton');
    }
  });

  it("pushes the GraphEdit's menu_panel box onto the panel (:837)", () => {
    const g = graphEdit();
    expect(menuPanel(g).styleBoxes.panel).toBe(g.styleBoxes.menu_panel);
  });

  it('shows the icon each theme item names on each Button (:826-832)', () => {
    const icons = ROW.filter((n) => n.endsWith('_button')).map(
      (name) => propsOf<ButtonProperties>(item(graphEdit(), name)).themeIcon?.name
    );
    expect(icons).toEqual([
      'zoom_out',
      'zoom_reset',
      'zoom_in',
      'grid_toggle',
      'snapping_toggle',
      'minimap_toggle',
      'layout',
    ]);
  });

  it('writes the zoom as a whole percent in the label, centred, 48 px wide (:835, :2620-2624)', () => {
    const label = propsOf<LabelProperties>(item(graphEdit({ zoom: 0.5 }), 'zoom_label'));
    expect(label.text).toBe('50%');
    expect(label.horizontalAlignment).toBe(1);
    expect(label.customMinimumSize).toEqual({ x: 48, y: 0 });
  });

  it('rounds the zoom to a whole percent (:2620-2624)', () => {
    expect(propsOf<LabelProperties>(item(graphEdit({ zoom: 0.2326 }), 'zoom_label')).text).toBe('23%');
  });

  it('gives the SpinBox the snapping range 2 to 100 and the snapping distance (:3293-3298)', () => {
    const spin = propsOf<SpinBoxProperties>(
      item(graphEdit({ snappingDistance: 35 }), 'snapping_distance_spinbox')
    );
    expect([spin.minValue, spin.maxValue, spin.step, spin.value]).toEqual([2, 100, 1, 35]);
  });
});

describe('the toolbar for the GraphEdit properties', () => {
  it('hides the zoom label by default and shows it with show_zoom_label (:2821-2824)', () => {
    expect(isShown(item(graphEdit(), 'zoom_label'))).toBe(false);
    expect(isShown(item(graphEdit({ showZoomLabel: true }), 'zoom_label'))).toBe(true);
  });

  it('hides the three zoom buttons with show_zoom_buttons off (:2830-2836)', () => {
    const g = graphEdit({ showZoomButtons: false });
    expect(
      ['zoom_minus_button', 'zoom_reset_button', 'zoom_plus_button'].map((n) => isShown(item(g, n)))
    ).toEqual([false, false, false]);
  });

  it('hides both grid toggles and the SpinBox with show_grid_buttons off (:2842-2848)', () => {
    const g = graphEdit({ showGridButtons: false });
    expect(
      ['toggle_grid_button', 'toggle_snapping_button', 'snapping_distance_spinbox'].map((n) =>
        isShown(item(g, n))
      )
    ).toEqual([false, false, false]);
  });

  it('hides only its own button for show_minimap_button and show_arrange_button (:2854-2866)', () => {
    expect(isShown(item(graphEdit({ showMinimapButton: false }), 'minimap_button'))).toBe(false);
    expect(isShown(item(graphEdit({ showArrangeButton: false }), 'arrange_button'))).toBe(false);
  });

  it('hides menu_panel with show_menu off (:2812-2815)', () => {
    expect(isShown(menuPanel(graphEdit({ showMenu: false })))).toBe(false);
  });

  it('presses the grid and snapping toggles with show_grid and snapping_enabled (:2709, :2735)', () => {
    const pressed = (g: SolveNode, name: string) =>
      propsOf<ButtonProperties>(item(g, name)).buttonPressed === true;
    expect(pressed(graphEdit(), 'toggle_grid_button')).toBe(true);
    expect(pressed(graphEdit({ showGrid: false }), 'toggle_grid_button')).toBe(false);
    expect(pressed(graphEdit(), 'toggle_snapping_button')).toBe(true);
    expect(pressed(graphEdit({ snappingEnabled: false }), 'toggle_snapping_button')).toBe(false);
  });

  it('disables the zoom buttons at their bounds (:2445-2446)', () => {
    const g = graphEdit({ zoomMinusDisabled: true });
    expect(propsOf<ButtonProperties>(item(g, 'zoom_minus_button')).disabled).toBe(true);
    expect(propsOf<ButtonProperties>(item(g, 'zoom_plus_button')).disabled).not.toBe(true);
  });
});

describe('where the toolbar sits', () => {
  function solvedPanel(g: SolveNode) {
    const ctx = createSolveContext(THEME, measureText);
    const solved = solveControlTree([g], { x: 0, y: 0, w: 600, h: 400 }, ctx);
    return solved.get(menuPanel(g).path)!.rect;
  }

  it('places menu_panel at (10, 10) at its minimum size (:3232)', () => {
    const g = graphEdit({ offsetRight: 600, offsetBottom: 400 });
    const rect = solvedPanel(g);
    expect([rect.x, rect.y]).toEqual([10, 10]);
    expect(rect.w).toBeGreaterThan(0);
  });

  it('mirrors the position in a right-to-left layout (control.cpp:1785-1787)', () => {
    const g = graphEdit({ offsetRight: 600, offsetBottom: 400 }, true);
    const rect = solvedPanel(g);
    expect(rect.x + rect.w).toBe(590);
  });

  it('draws the toolbar between the scroll bars and the minimap of top_layer (:3211-3329)', () => {
    const back = wholeKeySlot(9);
    expect(internalBackSlotOf(graphEdit(), back)).toEqual(
      canvasSubOrders(back, ['scrollBars', 'toolbar', 'minimap']).toolbar
    );
  });
});
