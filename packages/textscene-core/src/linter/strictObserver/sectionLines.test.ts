import { describe, expect, it } from 'vitest';
import { sectionLines } from './sectionLines.js';
import type { BuiltSection } from '../../parser/types.js';

const built = (id: string) => ({ id, type: 'Resource', data: {} }) as unknown as BuiltSection;

describe('sectionLines', () => {
  it('files the heading and property lines of a section under what it built', () => {
    const recorder = sectionLines();
    const section = built('a');
    recorder.start(5);
    recorder.record('size', 4, 2);
    recorder.built(section, 3);
    expect(recorder.lines.get(section)).toEqual({
      heading: 3,
      headingColumn: 5,
      properties: new Map([['size', 4]]),
      propertyColumns: new Map([['size', 2]]),
    });
  });

  it('starts each section with no property lines', () => {
    const recorder = sectionLines();
    const [first, second] = [built('a'), built('b')];
    recorder.start(1);
    recorder.record('size', 4, 1);
    recorder.built(first, 3);
    recorder.start(1);
    recorder.built(second, 6);
    expect(recorder.lines.get(first)!.properties.size).toBe(1);
    expect(recorder.lines.get(second)!.properties.size).toBe(0);
  });

  it('holds nothing for a section that was never built', () => {
    const recorder = sectionLines();
    recorder.start(1);
    recorder.record('size', 4, 1);
    expect(recorder.lines.size).toBe(0);
  });
});
