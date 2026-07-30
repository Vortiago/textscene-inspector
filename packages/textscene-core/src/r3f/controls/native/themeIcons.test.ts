import { describe, expect, it } from 'vitest';
import { CHECK_BOX_ICONS, OPTION_BUTTON_ICONS } from './themeIcons';

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
  // scene/theme/default_theme.cpp:288-295 — CheckBox registers exactly
  // these eight icon keys; each maps 1:1 to `scene/theme/icons/<key>.svg`
  // via `default_theme_icons_builders.py` (theme key == SVG filename stem).
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
    // scene/theme/default_theme.cpp:235 —
    // `theme->set_icon("arrow", "OptionButton", icons["option_button_arrow"])`.
    // scene/theme/icons/option_button_arrow.svg is authored at 12x12.
    const svg = decodeSvg(OPTION_BUTTON_ICONS.arrow);
    expect(svg).toContain('<svg');
    const { width, height } = svgSize(svg);
    expect(width).toBe(12);
    expect(height).toBe(12);
  });
});
