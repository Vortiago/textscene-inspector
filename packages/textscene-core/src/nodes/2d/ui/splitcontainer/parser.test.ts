import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseSplitContainer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseSplitContainer', () => {
  it('delegates to the shared SplitContainer base and carries name + split_offset', () => {
    const props = parseSplitContainer(h({ name: 'Split', type: 'SplitContainer' }), {
      split_offset: '40',
    });
    expect(props.name).toBe('Split');
    expect(props.splitOffset).toBe(40);
  });

  it('parses vertical true', () => {
    const props = parseSplitContainer(h({ name: 'Split', type: 'SplitContainer' }), {
      vertical: 'true',
    });
    expect(props.vertical).toBe(true);
  });

  it('leaves vertical undefined when absent — Godot default false', () => {
    const props = parseSplitContainer(h({ name: 'Split', type: 'SplitContainer' }), {});
    expect(props.vertical).toBeUndefined();
  });

  it('reads an unparseable vertical as false — a bool slot stores what it can, never unset', () => {
    const props = parseSplitContainer(h({ name: 'Split', type: 'SplitContainer' }), {
      vertical: 'garbage',
    });
    expect(props.vertical).toBe(false);
  });
});
