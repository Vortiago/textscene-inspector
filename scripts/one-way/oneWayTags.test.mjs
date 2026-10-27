import { describe, expect, it } from 'vitest';
import { oneWayEntries, renderOneWayList } from './oneWayTags.mjs';

const FILE = 'utils/perObject.ts';

function source(doc, declaration) {
  return `/**\n${doc.map((line) => ` * ${line}`.trimEnd()).join('\n')}\n */\n${declaration}\n`;
}

describe('oneWayEntries', () => {
  it('reads the job, the export it sits on and the file', () => {
    const text = source(
      ['A reader.', '', '@oneWay A cache keyed by an object'],
      'export function perObject() {}'
    );
    expect(oneWayEntries(text, FILE)).toEqual([
      { job: 'A cache keyed by an object', note: '', name: 'perObject', file: FILE },
    ]);
  });

  it('reads the lines after the job as its note, up to the next tag', () => {
    const doc = [
      '@oneWay A cache keyed by an object',
      '  It holds a WeakMap.',
      '  A throw stores nothing.',
      '@returns a reader',
    ];
    expect(oneWayEntries(source(doc, 'export const perObject = 1;'), FILE)[0].note).toBe(
      'It holds a WeakMap. A throw stores nothing.'
    );
  });

  it('names each kind of export declaration', () => {
    const declarations = [
      ['export async function load() {}', 'load'],
      ['export class ResRoots {}', 'ResRoots'],
      ['export interface LiveTree {}', 'LiveTree'],
      ['export type Rows = number;', 'Rows'],
      ['export let counter = 0;', 'counter'],
    ];
    for (const [declaration, name] of declarations) {
      expect(oneWayEntries(source(['@oneWay A job'], declaration), FILE)[0].name).toBe(name);
    }
  });

  it('reads a tagged export that follows the module comment', () => {
    const text = `/** The module. */\n\n${source(['@oneWay A job'], 'export function joinPath() {}')}`;
    expect(oneWayEntries(text, FILE).map(({ name }) => name)).toEqual(['joinPath']);
  });

  it('reads no entry from a doc comment with no tag', () => {
    expect(oneWayEntries(source(['A reader.'], 'export function perObject() {}'), FILE)).toEqual([]);
  });

  it('refuses a tag on a declaration that is not exported, so a tag cannot name a private helper', () => {
    expect(() => oneWayEntries(source(['@oneWay A job'], 'function hidden() {}'), FILE)).toThrow(
      'utils/perObject.ts:4: expected an export after the @oneWay doc comment, got "function hidden() {}"'
    );
  });

  it('refuses a tag with no job', () => {
    expect(() => oneWayEntries(source(['@oneWay'], 'export function perObject() {}'), FILE)).toThrow(
      'utils/perObject.ts: expected a job after @oneWay on perObject, got none'
    );
  });
});

describe('renderOneWayList', () => {
  const entry = (job, name, file, note = '') => ({ job, note, name, file });

  it('writes one line for each job, with its helpers and their file', () => {
    expect(renderOneWayList([entry('Angles', 'degToRad', 'godot/math/math.ts')])).toBe(
      '- Angles: `degToRad` in `godot/math/math.ts`.\n'
    );
  });

  it('joins the helpers of one job in one file, and the files of one job', () => {
    const entries = [
      entry('Angles', 'degToRad', 'godot/math/math.ts'),
      entry('Angles', 'radToDeg', 'godot/math/math.ts'),
      entry('Angles', 'turns', 'godot/math/turns.ts'),
    ];
    expect(renderOneWayList(entries)).toBe(
      '- Angles: `degToRad` and `radToDeg` in `godot/math/math.ts`, and `turns` in `godot/math/turns.ts`.\n'
    );
  });

  it('adds the note after the helpers', () => {
    expect(
      renderOneWayList([entry('Angles', 'degToRad', 'godot/math/math.ts', 'Never divide by 180.')])
    ).toBe('- Angles: `degToRad` in `godot/math/math.ts`. Never divide by 180.\n');
  });

  it('orders the jobs by file path, with test helpers last', () => {
    const entries = [
      entry('In tests, the loads', 'settleLoads', 'r3f/testing/settleLoads.ts'),
      entry('Paths', 'joinPath', 'utils/nodePath.ts'),
      entry('Angles', 'degToRad', 'godot/math/math.ts'),
    ];
    expect(
      renderOneWayList(entries)
        .split('\n')
        .map((line) => line.slice(0, 12))
    ).toEqual(['- Angles: `d', '- Paths: `jo', '- In tests, ', '']);
  });

  it('wraps at 100 columns without breaking a code span', () => {
    const note = 'Read it with `an as const object` and a long tail of words that runs past the edge.';
    const lines = renderOneWayList([entry('Angles', 'degToRad', 'godot/math/math.ts', note)])
      .trimEnd()
      .split('\n');
    expect(lines.every((line) => line.length <= 100)).toBe(true);
    expect(lines.slice(1).every((line) => line.startsWith('  '))).toBe(true);
    expect(lines.some((line) => line.includes('`an as const object`'))).toBe(true);
  });
});
