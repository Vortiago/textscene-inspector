import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseProgressBar } from './parser';

const HEADING: ParsedHeading = { type: 'ProgressBar', attributes: { name: 'MyProgressBar' } };

describe('parseProgressBar', () => {
  it('parses fill_mode, show_percentage, indeterminate and editor_preview_indeterminate', () => {
    const props = parseProgressBar(HEADING, {
      fill_mode: '2',
      show_percentage: 'false',
      indeterminate: 'true',
      editor_preview_indeterminate: 'true',
    });
    expect(props.fillMode).toBe(2);
    expect(props.showPercentage).toBe(false);
    expect(props.indeterminate).toBe(true);
    expect(props.editorPreviewIndeterminate).toBe(true);
  });

  it('leaves every own property undefined when absent, so a caller falls back to the Godot default', () => {
    const props = parseProgressBar(HEADING, {});
    expect(props.fillMode).toBeUndefined();
    expect(props.showPercentage).toBeUndefined();
    expect(props.indeterminate).toBeUndefined();
    expect(props.editorPreviewIndeterminate).toBeUndefined();
  });

  it('also parses the Range base it reuses (value/min_value/max_value)', () => {
    const props = parseProgressBar(HEADING, { value: '42', min_value: '0', max_value: '200' });
    expect(props.value).toBe(42);
    expect(props.minValue).toBe(0);
    expect(props.maxValue).toBe(200);
  });
});
