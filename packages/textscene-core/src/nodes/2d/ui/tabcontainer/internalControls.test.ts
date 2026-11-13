/** TabContainer's internal TabBar: the spec it builds and the theme items it pushes (`tab_container.cpp:307-346`). */
import { describe, expect, it } from 'vitest';
import { defaultThemeAt } from '../../../../godot/scene/defaultTheme/defaultTheme';
import { defaultStyleBoxesOf } from '../../../../r3f/controls/native/defaultThemeRecords';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { internalControlsOf } from '../../../../r3f/controls/native/internalControls';
import { createSolveContext, solveControlTree } from '../../../../r3f/controls/native/controlRectSolver';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { SolveNode, ThemedIconRef } from '../../../../r3f/controls/native/solveTree';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import { themeResource } from '../../../../r3f/controls/native/testing/themeResource';
import { systemFont } from '../../../../r3f/controls/native/text/sfntOutlines.testkit';
import { NO_PROJECT_FONTS } from '../../../../resources/fonts/font/projectFonts';
import type { TabBarProperties } from '../tabbar/types';
import type { TabContainerProperties } from './types';
import { tabBarPushedItems } from './internalControls';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import './nativeSolver';

const THEME = nativeTheme(1);
const RED = { r: 1, g: 0, b: 0, a: 1 };

function page(name: string): SolveNode {
  return withThemeItems({
    ...solveNode(),
    path: `Tabs/${name}`,
    node: controlNode(name, 'Control', { name }),
  });
}

function container(
  props: Partial<TabContainerProperties> = {},
  projectTheme: ThemeResource | null = null,
  pages = ['A', 'B']
): SolveNode {
  return withThemeItems({
    ...solveNode(),
    path: 'Tabs',
    node: controlNode('Tabs', 'TabContainer', { name: 'Tabs', ...props }),
    projectFonts: { ...NO_PROJECT_FONTS, projectTheme },
    children: pages.map(page),
  });
}

function barOf(n: SolveNode): SolveNode {
  return internalControlsOf(n, THEME)[0]!.node;
}

function barProps(n: SolveNode): TabBarProperties {
  return barOf(n).node.properties as TabBarProperties;
}

describe('the TabBar a TabContainer builds', () => {
  it('is one TabBar at the path <container>/@TabBar', () => {
    const [bar, ...rest] = internalControlsOf(container(), THEME);
    expect(rest).toEqual([]);
    expect(bar!.node.node.type).toBe('TabBar');
    expect(bar!.node.path).toBe('Tabs/@TabBar');
  });

  it('is built only while the header shows', () => {
    expect(internalControlsOf(container({ tabsVisible: false }), THEME)).toEqual([]);
  });

  it('is built only while the container has a page', () => {
    expect(internalControlsOf(container({}, null, []), THEME)).toEqual([]);
  });

  it.each([true, false, undefined])(
    'is in front mode with all_tabs_in_front %s, since a loaded bar never leaves it (:868-877, :1282)',
    (allTabsInFront) => {
      expect(internalControlsOf(container({ allTabsInFront }), THEME)[0]!.mode).toBe('front');
    }
  );

  it.each([
    [0, false],
    [1, true],
  ])('flips its tab style with tabs_position %i: %s (tab_container.cpp:826)', (tabsPosition, isFlipped) => {
    expect(barProps(container({ tabsPosition })).tabStyleVFlip).toBe(isFlipped);
  });

  it('has a tab for each page, named after it', () => {
    expect(barProps(container()).tabs!.map((tab) => tab.title)).toEqual(['A', 'B']);
  });

  it('hands the bar the current page and leaves scroll_to_selected at the bar default', () => {
    const props = barProps(container({ currentTab: 1 }));
    expect(props.currentTab).toBe(1);
    expect(props.scrollToSelected).toBeUndefined();
  });

  it('never shows a close button and sets no maximum tab width, as TabContainer exposes neither', () => {
    const props = barProps(container());
    expect(props.tabCloseDisplayPolicy).toBe(0);
    expect(props.maxTabWidth).toBe(0);
  });
});

describe('the theme items a TabContainer pushes onto its TabBar', () => {
  it('pushes every item of _on_theme_changed (tab_container.cpp:314-344)', () => {
    const pushed = tabBarPushedItems(container());
    expect(Object.keys(pushed.styleBoxes!).sort()).toEqual(
      ['tab_disabled', 'tab_focus', 'tab_hovered', 'tab_selected', 'tab_unselected'].sort()
    );
    expect(Object.keys(pushed.icons!).sort()).toEqual(
      ['decrement', 'decrement_highlight', 'drop_mark', 'increment', 'increment_highlight'].sort()
    );
    expect(Object.keys(pushed.colors!).sort()).toEqual(
      [
        'drop_mark_color',
        'font_disabled_color',
        'font_hovered_color',
        'font_outline_color',
        'font_selected_color',
        'font_unselected_color',
        'icon_disabled_color',
        'icon_hovered_color',
        'icon_selected_color',
        'icon_unselected_color',
      ].sort()
    );
    expect(Object.keys(pushed.constants!).sort()).toEqual(
      ['h_separation', 'icon_max_width', 'outline_size', 'tab_separation'].sort()
    );
    expect(Object.keys(pushed.fontOverrides!)).toEqual(['font']);
  });

  it("resolves the bar's own theme items the container does not push, such as TabBar/icons/close", () => {
    const projectTheme = themeResource({ icons: { TabBar: { close: 'ExtResource("1")' } } });
    expect(barOf(container({}, projectTheme)).icons.close?.ref).toBe('ExtResource("1")');
  });

  it('ignores a TabBar theme colour for a name the container pushes', () => {
    const projectTheme = themeResource({ colors: { TabBar: { font_selected_color: RED } } });
    const n = container({}, projectTheme);
    expect(barOf(n).colors.font_selected_color).toEqual(n.colors.font_selected_color);
    expect(barOf(n).colors.font_selected_color).not.toEqual(RED);
  });

  it('ignores a TabBar theme icon for a name the container pushes, though the container has none of its own', () => {
    const projectTheme = themeResource({ icons: { TabBar: { increment: 'ExtResource("1")' } } });
    expect(barOf(container({}, projectTheme)).icons.increment).toBeUndefined();
  });

  it("keeps the bar's own close button box over a container override of that name", () => {
    const n = container();
    const withOverride = { ...n, styleBoxes: { ...n.styleBoxes, button_highlight: n.styleBoxes.panel! } };
    expect(barOf(withOverride).styleBoxes.button_highlight).toEqual(
      defaultStyleBoxesOf(defaultThemeAt(1)).TabBar!.button_highlight
    );
  });

  it("pushes the container's own theme_override_font_sizes/font_size", () => {
    const props = barProps(container({ themeOverrideFontSizes: { font_size: 28 } }));
    expect(props.themeOverrideFontSizes?.font_size).toBe(28);
  });

  it('pushes a TabContainer/font_size of an ancestor Theme, and a TabBar/font_size never reaches the bar', () => {
    const projectTheme = themeResource({
      fontSizes: { TabContainer: { font_size: 22 }, TabBar: { font_size: 9 } },
    });
    expect(barProps(container({}, projectTheme)).themeOverrideFontSizes?.font_size).toBe(22);
  });

  it('falls back to the built-in default size when nothing resolves', () => {
    expect(barProps(container()).themeOverrideFontSizes?.font_size).toBe(THEME.fontSize);
  });

  it('pushes the font of a TabContainer theme entry over a TabBar one (tab_container.cpp:338)', () => {
    const containerFont = systemFont();
    const projectTheme = themeResource({
      fonts: { TabContainer: { font: containerFont }, TabBar: { font: systemFont() } },
    });
    expect(barOf(container({}, projectTheme)).fontOverrides.font).toBe(containerFont);
  });
});

describe('the solve of a TabContainer', () => {
  it('holds a rect for its TabBar at <container>/@TabBar', () => {
    const n = {
      ...container(),
      node: controlNode('Tabs', 'TabContainer', { name: 'Tabs', offsetRight: 300, offsetBottom: 200 }),
    };
    const solved = solveControlTree(
      [n],
      { x: 0, y: 0, w: 1152, h: 648 },
      createSolveContext(THEME, measureText)
    );
    const bar = solved.get('Tabs/@TabBar')!.rect;
    expect(bar.w).toBeGreaterThan(0);
    expect(bar.h).toBeGreaterThan(0);
  });
});

describe('the texture slots a TabContainer asks for', () => {
  const ICON: ThemedIconRef = {
    ref: 'ExtResource("1")',
    resources: { externalResources: [], internalResources: [] },
    isHeldLocally: true,
  };

  it('asks for the scroll icons it pushes, under the keys its TabBar reads (tab_container.cpp:320-323)', () => {
    const node = controlNode('Tabs', 'TabContainer', { name: 'Tabs' });
    const requests = controlSolverRegistry.textureSlots('TabContainer')!(node, {
      increment: ICON,
      decrement: ICON,
    });
    expect(requests.map((request) => request.key).sort()).toEqual(['decrement', 'increment']);
  });
});
