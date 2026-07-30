import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseSubViewportContainer } from './parser';

/** Defaults from `doc/classes/SubViewportContainer.xml`: stretch false, shrink 1. */
describe('parseSubViewportContainer', () => {
  it('parses stretch and stretch_shrink (happy path)', () => {
    const result = parseSubViewportContainer(
      heading('SubViewportContainer', { name: 'Booth', parent: '.' }),
      { stretch: 'true', stretch_shrink: '2' }
    );
    expect(result.name).toBe('Booth');
    expect(result.stretch).toBe(true);
    expect(result.stretch_shrink).toBe(2);
  });

  it('inherits Control layout properties', () => {
    const result = parseSubViewportContainer(heading('SubViewportContainer', { name: 'B' }), {
      offset_left: '100.0',
      offset_right: '400.0',
    });
    expect(result.offsetLeft).toBe(100);
    expect(result.offsetRight).toBe(400);
  });

  it('applies Godot defaults when both are absent (edge case)', () => {
    const result = parseSubViewportContainer(heading('SubViewportContainer', { name: 'B' }), {});
    expect(result.stretch).toBe(false);
    expect(result.stretch_shrink).toBe(1);
  });

  it('falls back on malformed values (error path)', () => {
    const result = parseSubViewportContainer(heading('SubViewportContainer', { name: 'B' }), {
      stretch: 'sure',
      stretch_shrink: 'lots',
    });
    expect(result.stretch).toBe(false);
    expect(result.stretch_shrink).toBe(1);
  });
});
