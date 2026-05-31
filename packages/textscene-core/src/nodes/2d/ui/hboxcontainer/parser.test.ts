import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseHBoxContainer, isHBoxContainer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseHBoxContainer', () => {
  it('delegates to Control and carries name + visibility', () => {
    const props = parseHBoxContainer(h({ name: 'Row', type: 'HBoxContainer' }), {
      visible: 'false',
    });
    expect(props.name).toBe('Row');
    expect(props.visible).toBe(false);
  });

  it('collects separation theme override constant', () => {
    const props = parseHBoxContainer(h({ name: 'Row', type: 'HBoxContainer' }), {
      'theme_override_constants/separation': '12',
    });
    expect(props.themeOverrideConstants?.separation).toBe(12);
  });

  it('type guard accepts HBoxContainer and rejects others', () => {
    expect(isHBoxContainer(h({ type: 'HBoxContainer' }))).toBe(true);
    expect(isHBoxContainer(h({ type: 'VBoxContainer' }))).toBe(false);
  });
});
