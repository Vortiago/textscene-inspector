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
    expect(
      parseRichTextLabel(h({ name: 'T', type: 'RichTextLabel' }), { autowrap_mode: '2' }).autowrapMode
    ).toBe(2);
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

  // Defaults: `DEFAULT_JUSTIFICATION_FLAGS` (`rich_text_label.h:582`) and the constructor's
  // `set_clip_contents(true)` (`rich_text_label.cpp:8225`).
  it('defaults justification_flags to 163 and clip_contents to true', () => {
    const p = parseRichTextLabel(h({ name: 'T', type: 'RichTextLabel' }), {});
    expect(p.justificationFlags).toBe(163);
    expect(p.clipContents).toBe(true);
  });

  it('reads justification_flags as authored, and clip_contents = false', () => {
    const p = parseRichTextLabel(h({ name: 'T', type: 'RichTextLabel' }), {
      justification_flags: '66',
      clip_contents: 'false',
    });
    expect(p.justificationFlags).toBe(66);
    expect(p.clipContents).toBe(false);
  });

  it('defaults scroll_active to true (rich_text_label.h:565) and reads scroll_active = false', () => {
    const heading = h({ name: 'T', type: 'RichTextLabel' });
    expect(parseRichTextLabel(heading, {}).scrollActive).toBe(true);
    expect(parseRichTextLabel(heading, { scroll_active: 'false' }).scrollActive).toBe(false);
  });

  it('defaults scroll_following to false (rich_text_label.h:561) and reads scroll_following = true', () => {
    const heading = h({ name: 'T', type: 'RichTextLabel' });
    expect(parseRichTextLabel(heading, {}).scrollFollowing).toBe(false);
    expect(parseRichTextLabel(heading, { scroll_following: 'true' }).scrollFollowing).toBe(true);
  });

  it('defaults text_direction to AUTO, language to empty and the override to DEFAULT', () => {
    const p = parseRichTextLabel(h({ name: 'T', type: 'RichTextLabel' }), {});
    expect(p.textDirection).toBe(0);
    expect(p.language).toBe('');
    expect(p.structuredTextBidiOverride).toBe(0);
    expect(p.structuredTextBidiOverrideOptions).toEqual([]);
  });

  it('reads text_direction, language and the structured override', () => {
    const p = parseRichTextLabel(h({ name: 'T', type: 'RichTextLabel' }), {
      text_direction: '2',
      language: '"he"',
      structured_text_bidi_override: '2',
    });
    expect(p.textDirection).toBe(2);
    expect(p.language).toBe('he');
    expect(p.structuredTextBidiOverride).toBe(2);
  });
});
