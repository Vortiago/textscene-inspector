import { describe, expect, it } from 'vitest';
import {
  CHECK_BOX_ICONS,
  OPTION_BUTTON_ICONS,
  SPLIT_CONTAINER_ICONS,
  SLIDER_GRABBER_ICONS,
  SLIDER_TICK_ICONS,
  CHECK_BUTTON_ICONS,
  CHECK_BUTTON_ICON_NATURAL_SIZE,
  FOLDABLE_CONTAINER_ICONS,
  TEXT_EDIT_GLYPH_ICONS,
  TAB_BAR_ICONS,
  SCROLL_HINT_ICONS,
  TAB_BAR_ICON_SIZE,
  MINI_CHECKERBOARD_ICON,
  COLOR_PICKER_OVERBRIGHT_ICON,
  COLOR_PICKER_CURSOR_ICON,
  COLOR_PICKER_CURSOR_BG_ICON,
  MINI_CHECKERBOARD_SIZE,
  COLOR_PICKER_CURSOR_SIZE,
  GRAPH_EDIT_ICONS,
  GRAPH_EDIT_ICON_SIZE,
  GRAPH_EDIT_MINIMAP_RESIZER_ICON,
} from './themeIcons';

const DATA_URL_PREFIX = 'data:image/svg+xml;base64,';

function decodeSvg(dataUrl: string): string {
  expect(dataUrl.startsWith(DATA_URL_PREFIX)).toBe(true);
  return atob(dataUrl.slice(DATA_URL_PREFIX.length));
}

function svgSize(svg: string): { width: number; height: number } {
  return {
    width: Number(svg.match(/\swidth="([\d.]+)"/)?.[1]),
    height: Number(svg.match(/\sheight="([\d.]+)"/)?.[1]),
  };
}

describe('CHECK_BOX_ICONS', () => {
  // scene/theme/default_theme.cpp:288-295: CheckBox registers exactly
  // these eight icon keys; each maps 1:1 to `scene/theme/icons/<key>.svg`
  // through `default_theme_icons_builders.py` (theme key == SVG filename stem).
  const ids = [
    'checked',
    'checkedDisabled',
    'unchecked',
    'uncheckedDisabled',
    'radioChecked',
    'radioCheckedDisabled',
    'radioUnchecked',
    'radioUncheckedDisabled',
  ] as const;

  it.each(ids)('%s resolves to a data: URL whose decoded SVG has a valid, positive width/height', (id) => {
    const svg = decodeSvg(CHECK_BOX_ICONS[id]);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    // scene/theme/icons/{checked,unchecked,radio_checked,radio_unchecked}*.svg
    // are all authored at 16x16.
    expect(width).toBe(16);
    expect(height).toBe(16);
  });

  it('has no duplicate icon across draw states (each is a distinct data: URL)', () => {
    const values = ids.map((id) => CHECK_BOX_ICONS[id]);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('OPTION_BUTTON_ICONS', () => {
  it('arrow resolves to a data: URL whose decoded SVG has a valid, positive width/height', () => {
    // scene/theme/default_theme.cpp:235:
    // `theme->set_icon("arrow", "OptionButton", icons["option_button_arrow"])`.
    // scene/theme/icons/option_button_arrow.svg is authored at 12x12.
    const svg = decodeSvg(OPTION_BUTTON_ICONS.arrow);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(12);
    expect(height).toBe(12);
  });
});

describe('SPLIT_CONTAINER_ICONS', () => {
  it('hsplitter is 8x48 — default_theme.cpp:1244,1247 (HSplitContainer/SplitContainer h_grabber)', () => {
    const svg = decodeSvg(SPLIT_CONTAINER_ICONS.hsplitter);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(8);
    expect(height).toBe(48);
  });

  it('vsplitter is 48x8 — default_theme.cpp:1245-1246 (VSplitContainer/SplitContainer v_grabber)', () => {
    const svg = decodeSvg(SPLIT_CONTAINER_ICONS.vsplitter);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(48);
    expect(height).toBe(8);
  });

  it('the two icons are distinct data: URLs', () => {
    expect(SPLIT_CONTAINER_ICONS.hsplitter).not.toBe(SPLIT_CONTAINER_ICONS.vsplitter);
  });
});

describe('SLIDER_GRABBER_ICONS', () => {
  it.each(['grabber', 'grabberDisabled'] as const)(
    '%s is 16x16 — default_theme.cpp:589-591,604-606 (HSlider/VSlider grabber icons)',
    (id) => {
      const svg = decodeSvg(SLIDER_GRABBER_ICONS[id]);
      expect(svg).toContain('<svg');
      const { width, height } = svgSize(svg);
      expect(width).toBe(16);
      expect(height).toBe(16);
    }
  );

  it('the two icons are distinct data: URLs', () => {
    expect(SLIDER_GRABBER_ICONS.grabber).not.toBe(SLIDER_GRABBER_ICONS.grabberDisabled);
  });
});

describe('SLIDER_TICK_ICONS', () => {
  it('hslider is 4x8 — default_theme.cpp:592 (HSlider tick)', () => {
    const svg = decodeSvg(SLIDER_TICK_ICONS.hslider);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(4);
    expect(height).toBe(8);
  });

  it('vslider is 8x4 — default_theme.cpp:607 (VSlider tick), the transpose of hslider', () => {
    const svg = decodeSvg(SLIDER_TICK_ICONS.vslider);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(8);
    expect(height).toBe(4);
  });

  it('the two icons are distinct data: URLs', () => {
    expect(SLIDER_TICK_ICONS.hslider).not.toBe(SLIDER_TICK_ICONS.vslider);
  });
});

describe('CHECK_BUTTON_ICONS', () => {
  // default_theme.cpp:327-330: CheckButton's four non-mirrored draw states.
  const ids = ['checked', 'checkedDisabled', 'unchecked', 'uncheckedDisabled'] as const;

  it.each(ids)('%s resolves to a data: URL whose decoded SVG is 32x16', (id) => {
    const svg = decodeSvg(CHECK_BUTTON_ICONS[id]);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(32);
    expect(height).toBe(16);
  });

  it('has no duplicate icon across draw states', () => {
    const values = ids.map((id) => CHECK_BUTTON_ICONS[id]);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('CHECK_BUTTON_ICON_NATURAL_SIZE', () => {
  it('is 32x16 — every vendored CheckButton icon shares this authored size', () => {
    expect(CHECK_BUTTON_ICON_NATURAL_SIZE).toEqual({ x: 32, y: 16 });
  });
});

describe('FOLDABLE_CONTAINER_ICONS', () => {
  // default_theme.cpp:1329-1332: FoldableContainer's four fold-state arrows.
  const ids = ['expandedArrow', 'expandedArrowMirrored', 'foldedArrow', 'foldedArrowMirrored'] as const;

  it.each(ids)('%s resolves to a data: URL whose decoded SVG is 16x16', (id) => {
    const svg = decodeSvg(FOLDABLE_CONTAINER_ICONS[id]);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(16);
    expect(height).toBe(16);
  });

  it('has no duplicate icon across arrow states', () => {
    const values = ids.map((id) => FOLDABLE_CONTAINER_ICONS[id]);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('TEXT_EDIT_GLYPH_ICONS', () => {
  it('tab is 8x8 — default_theme.cpp:457,491 (TextEdit/CodeEdit tab)', () => {
    const svg = decodeSvg(TEXT_EDIT_GLYPH_ICONS.tab);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(8);
    expect(height).toBe(8);
  });

  it('space is 8x8 — default_theme.cpp:458,492 (TextEdit/CodeEdit space)', () => {
    const svg = decodeSvg(TEXT_EDIT_GLYPH_ICONS.space);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(8);
    expect(height).toBe(8);
  });

  it('the two icons are distinct data: URLs', () => {
    expect(TEXT_EDIT_GLYPH_ICONS.tab).not.toBe(TEXT_EDIT_GLYPH_ICONS.space);
  });
});

describe('TAB_BAR_ICONS', () => {
  it.each(['close', 'incrementScroll', 'decrementScroll'] as const)(
    '%s resolves to a data: URL whose decoded SVG is 16x16 — default_theme.cpp:1034,1036,1039',
    (id) => {
      const svg = decodeSvg(TAB_BAR_ICONS[id]);
      expect(svg).toContain('<svg');
      const { width, height } = svgSize(svg);
      expect(width).toBe(16);
      expect(height).toBe(16);
    }
  );

  it('has no duplicate icon across the three keys', () => {
    const values = [TAB_BAR_ICONS.close, TAB_BAR_ICONS.incrementScroll, TAB_BAR_ICONS.decrementScroll];
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('TAB_BAR_ICON_SIZE', () => {
  it('is 16 — every vendored TabBar icon shares this authored size', () => {
    expect(TAB_BAR_ICON_SIZE).toBe(16);
  });
});

describe('ColorPicker/ColorPickerButton icons', () => {
  it('MINI_CHECKERBOARD_ICON is 16x16 — default_theme.cpp:1096,1133 (sample_bg/bg)', () => {
    const svg = decodeSvg(MINI_CHECKERBOARD_ICON);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(MINI_CHECKERBOARD_SIZE);
    expect(height).toBe(MINI_CHECKERBOARD_SIZE);
  });

  it('COLOR_PICKER_OVERBRIGHT_ICON is 16x16 — default_theme.cpp:1098', () => {
    const svg = decodeSvg(COLOR_PICKER_OVERBRIGHT_ICON);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(16);
    expect(height).toBe(16);
  });

  it('COLOR_PICKER_CURSOR_ICON and COLOR_PICKER_CURSOR_BG_ICON are both 12x12 — default_theme.cpp:1100-1101', () => {
    for (const url of [COLOR_PICKER_CURSOR_ICON, COLOR_PICKER_CURSOR_BG_ICON]) {
      const svg = decodeSvg(url);
      expect(svg).toContain('<svg');
      const { width, height } = svgSize(svg);
      expect(width).toBe(COLOR_PICKER_CURSOR_SIZE);
      expect(height).toBe(COLOR_PICKER_CURSOR_SIZE);
    }
  });

  it('the four icons are pairwise distinct data: URLs', () => {
    const values = [
      MINI_CHECKERBOARD_ICON,
      COLOR_PICKER_OVERBRIGHT_ICON,
      COLOR_PICKER_CURSOR_ICON,
      COLOR_PICKER_CURSOR_BG_ICON,
    ];
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('GraphEdit/GraphEditMinimap icons', () => {
  // scene/theme/default_theme.cpp:1279-1285: GraphEdit registers exactly these
  // seven toolbar icon keys; :1349 registers the minimap's own resizer.
  const ids = ['zoomOut', 'zoomIn', 'zoomReset', 'gridToggle', 'minimapToggle', 'snappingToggle', 'layout'] as const;

  it.each(ids)('%s is 16x16 — every GraphEdit toolbar icon shares that authored size', (id) => {
    const svg = decodeSvg(GRAPH_EDIT_ICONS[id]);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(GRAPH_EDIT_ICON_SIZE);
    expect(height).toBe(GRAPH_EDIT_ICON_SIZE);
  });

  it('GRAPH_EDIT_MINIMAP_RESIZER_ICON is 16x16 — default_theme.cpp:1349 (resizer_nw)', () => {
    const svg = decodeSvg(GRAPH_EDIT_MINIMAP_RESIZER_ICON);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(GRAPH_EDIT_ICON_SIZE);
    expect(height).toBe(GRAPH_EDIT_ICON_SIZE);
  });

  it('all eight are pairwise distinct data: URLs', () => {
    const values = [...ids.map((id) => GRAPH_EDIT_ICONS[id]), GRAPH_EDIT_MINIMAP_RESIZER_ICON];
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('SCROLL_HINT_ICONS', () => {
  // scene/theme/default_theme.cpp:667-668: ScrollContainer registers exactly
  // these two icon keys, each 1:1 with `scene/theme/icons/<key>.svg`.
  it('vertical is the 32x24 fade `_update_scroll_hints` reads get_height() off (scroll_container.cpp:627)', () => {
    expect(svgSize(decodeSvg(SCROLL_HINT_ICONS.vertical))).toEqual({ width: 32, height: 24 });
  });

  it('horizontal is the 24x32 fade it reads get_width() off (scroll_container.cpp:643)', () => {
    expect(svgSize(decodeSvg(SCROLL_HINT_ICONS.horizontal))).toEqual({ width: 24, height: 32 });
  });

  it('both are gradients from white at alpha 0.3 to alpha 0, which is what makes the two stretch modes identical', () => {
    for (const url of [SCROLL_HINT_ICONS.vertical, SCROLL_HINT_ICONS.horizontal]) {
      const svg = decodeSvg(url);
      expect(svg).toContain('stop-color="#fff" stop-opacity=".3"');
      expect(svg).toContain('stop-color="#fff" stop-opacity="0"');
    }
  });
});
