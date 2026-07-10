import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../parser/utils';
import type { PropertySection } from '../../../core/NodeRegistry';
import { parseTimer } from './parser';
import { formatTimerProperties } from './propertyFormatter';

const HEADING: ParsedHeading = { type: 'node', attributes: { name: 'WaitTimer', type: 'Timer' } };

function valueOf(sections: PropertySection[], label: string): string | undefined {
  for (const section of sections) {
    const item = section.items.find((i) => i.label === label);
    if (item) return item.value;
  }
  return undefined;
}

describe('formatTimerProperties', () => {
  it('renders the Godot defaults when properties are absent (happy path)', () => {
    const sections = formatTimerProperties(parseTimer(HEADING, {}));
    expect(sections.map((s) => s.title)).toContain('Timer');
    expect(valueOf(sections, 'Wait Time (s)')).toBe('1.00');
    expect(valueOf(sections, 'Autostart')).toBe('false');
    expect(valueOf(sections, 'One Shot')).toBe('false');
    expect(valueOf(sections, 'Paused')).toBe('false');
    expect(valueOf(sections, 'Process Callback')).toBe('Idle');
    expect(valueOf(sections, 'Ignore Time Scale')).toBe('false');
  });

  it('reflects explicit values (edge case)', () => {
    const sections = formatTimerProperties(
      parseTimer(HEADING, {
        wait_time: '2.5',
        autostart: 'true',
        one_shot: 'true',
        paused: 'true',
        process_callback: '0',
        ignore_time_scale: 'true',
      })
    );
    expect(valueOf(sections, 'Wait Time (s)')).toBe('2.50');
    expect(valueOf(sections, 'Autostart')).toBe('true');
    expect(valueOf(sections, 'One Shot')).toBe('true');
    expect(valueOf(sections, 'Paused')).toBe('true');
    expect(valueOf(sections, 'Process Callback')).toBe('Physics');
    expect(valueOf(sections, 'Ignore Time Scale')).toBe('true');
  });
});
