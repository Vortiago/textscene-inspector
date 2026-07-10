import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseTimer } from './parser';

describe('parseTimer', () => {
  it('parses name, parent, and transform (happy path)', () => {
    const result = parseTimer(
      heading('Timer', { name: 'MyTimer', parent: '.' }),
      { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)' }
    );
    expect(result.name).toBe('MyTimer');
    expect(result.parent).toBe('.');
    expect(result.transform?.origin).toEqual({ x: 2, y: 3, z: 4 });
  });

  it('falls back to identity transform on a malformed transform (error path)', () => {
    const result = parseTimer(
      heading('Timer', { name: 'Bad' }),
      { transform: 'Transform3D(not, valid)' }
    );
    expect(result.transform?.basis_x).toEqual({ x: 1, y: 0, z: 0 });
    expect(result.transform?.origin).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('handles missing optional attributes (edge case)', () => {
    const result = parseTimer({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.transform).toBeUndefined();
  });

  it('parses wait_time/autostart/one_shot/paused/process_callback/ignore_time_scale (happy path)', () => {
    const result = parseTimer(heading('Timer', { name: 'WaitTimer' }), {
      wait_time: '1.5',
      autostart: 'true',
      one_shot: 'true',
      paused: 'false',
      process_callback: '0',
      ignore_time_scale: 'true',
    });
    expect(result.wait_time).toBe(1.5);
    expect(result.autostart).toBe(true);
    expect(result.one_shot).toBe(true);
    expect(result.paused).toBe(false);
    expect(result.process_callback).toBe(0);
    expect(result.ignore_time_scale).toBe(true);
  });

  it('leaves Timer-specific properties undefined when absent (edge case)', () => {
    const result = parseTimer(heading('Timer', { name: 'Bare' }), {});
    expect(result.wait_time).toBeUndefined();
    expect(result.autostart).toBeUndefined();
    expect(result.one_shot).toBeUndefined();
    expect(result.paused).toBeUndefined();
    expect(result.process_callback).toBeUndefined();
    expect(result.ignore_time_scale).toBeUndefined();
  });

  it('falls back to undefined for a malformed wait_time (error path)', () => {
    const result = parseTimer(heading('Timer', { name: 'Bad' }), { wait_time: 'nope' });
    expect(result.wait_time).toBeUndefined();
  });
});
