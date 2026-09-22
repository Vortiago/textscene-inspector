import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseBoxContainer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseBoxContainer', () => {
  it('delegates to the shared BoxContainer base and carries name + alignment', () => {
    const props = parseBoxContainer(h({ name: 'Wrapper', type: 'BoxContainer' }), {
      alignment: '1',
    });
    expect(props.name).toBe('Wrapper');
    expect(props.alignment).toBe(1);
  });

  it('parses vertical true', () => {
    const props = parseBoxContainer(h({ name: 'Wrapper', type: 'BoxContainer' }), {
      vertical: 'true',
    });
    expect(props.vertical).toBe(true);
  });

  it('leaves vertical undefined when absent — Godot default false', () => {
    const props = parseBoxContainer(h({ name: 'Wrapper', type: 'BoxContainer' }), {});
    expect(props.vertical).toBeUndefined();
  });

  it('reads an unparseable vertical as false — a bool slot stores what it can, never unset', () => {
    const props = parseBoxContainer(h({ name: 'Wrapper', type: 'BoxContainer' }), {
      vertical: 'garbage',
    });
    expect(props.vertical).toBe(false);
  });
});
