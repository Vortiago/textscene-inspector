import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseRichTextLabel } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseRichTextLabel', () => {
  it('unquotes text + parses bbcode/fit-content flags + font-size override', () => {
    const p = parseRichTextLabel(h({ name: 'T', type: 'RichTextLabel' }), {
      text: '"[b]Hello[/b]"',
      bbcode_enabled: 'true',
      fit_content: 'true',
      'theme_override_font_sizes/normal_font_size': '18',
    });
    expect(p.text).toBe('[b]Hello[/b]');
    expect(p.bbcodeEnabled).toBe(true);
    expect(p.fitContent).toBe(true);
    expect(p.themeOverrideFontSizes?.normal_font_size).toBe(18);
  });

  it('defaults flags to false when properties are absent', () => {
    const p = parseRichTextLabel(h({ name: 'T', type: 'RichTextLabel' }), {});
    expect(p.text).toBeUndefined();
    expect(p.bbcodeEnabled).toBe(false);
    expect(p.fitContent).toBe(false);
  });

  it('parses autowrap_mode (rich_text_label.cpp:7761), undefined when absent', () => {
    expect(parseRichTextLabel(h({ name: 'T', type: 'RichTextLabel' }), { autowrap_mode: '2' }).autowrapMode).toBe(2);
    expect(parseRichTextLabel(h({ name: 'T', type: 'RichTextLabel' }), {}).autowrapMode).toBeUndefined();
  });

  it('parses tab_stops, tab_size and autowrap_trim_flags', () => {
    const p = parseRichTextLabel(h({ name: 'T', type: 'RichTextLabel' }), {
      tab_stops: 'PackedFloat32Array(20, 40)',
      tab_size: '8',
      autowrap_trim_flags: '64',
    });
    expect(p.tabStopsPx).toEqual([20, 40]);
    expect(p.tabSize).toBe(8);
    expect(p.autowrapTrimFlags).toBe(64);
  });
});
