import { describe, expect, it } from 'vitest';
import { formatTimerProperties } from './propertyFormatter';
import { sectionsOf, valueOf } from '../../testing/inspectedScene';

describe('formatTimerProperties', () => {
  it('lists the Godot defaults of a node that sets nothing', async () => {
    const sections = await sectionsOf(formatTimerProperties, 'Timer');
    expect(sections.map((s) => s.title)).toContain('Timer');
    expect(valueOf(sections, 'Wait Time (s)')).toBe('1.00');
    expect(valueOf(sections, 'Autostart')).toBe('false');
    expect(valueOf(sections, 'One Shot')).toBe('false');
    expect(valueOf(sections, 'Paused')).toBe('false');
    expect(valueOf(sections, 'Process Callback')).toBe('Idle');
    expect(valueOf(sections, 'Ignore Time Scale')).toBe('false');
  });

  it('lists the values the file sets', async () => {
    const sections = await sectionsOf(formatTimerProperties, 'Timer', {
      wait_time: '2.5',
      autostart: 'true',
      one_shot: 'true',
      paused: 'true',
      process_callback: '0',
      ignore_time_scale: 'true',
    });
    expect(valueOf(sections, 'Wait Time (s)')).toBe('2.50');
    expect(valueOf(sections, 'Autostart')).toBe('true');
    expect(valueOf(sections, 'One Shot')).toBe('true');
    expect(valueOf(sections, 'Paused')).toBe('true');
    expect(valueOf(sections, 'Process Callback')).toBe('Physics');
    expect(valueOf(sections, 'Ignore Time Scale')).toBe('true');
  });
});
