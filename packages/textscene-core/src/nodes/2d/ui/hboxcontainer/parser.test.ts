import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseHBoxContainer } from './parser';

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

  it.each([
    ['0', 0],
    ['1', 1],
    ['2', 2],
  ])('parses alignment %s as %i', (raw, expected) => {
    const props = parseHBoxContainer(h({ name: 'Row', type: 'HBoxContainer' }), {
      alignment: raw,
    });
    expect(props.alignment).toBe(expected);
  });

  it('leaves alignment undefined when absent', () => {
    const props = parseHBoxContainer(h({ name: 'Row', type: 'HBoxContainer' }), {});
    expect(props.alignment).toBeUndefined();
  });

  it('ignores a malformed (non-numeric) alignment', () => {
    const props = parseHBoxContainer(h({ name: 'Row', type: 'HBoxContainer' }), {
      alignment: 'garbage',
    });
    expect(props.alignment).toBeUndefined();
  });
});
