import { describe, expect, it } from 'vitest';
import { canonicalEntries, renderCanonicalList } from './canonicalTags.mjs';

const FILE = 'utils/perObject.ts';

function source(doc, declaration) {
  return `/**\n${doc.map((line) => ` * ${line}`.trimEnd()).join('\n')}\n */\n${declaration}\n`;
}

describe('canonicalEntries', () => {
  it('reads the job, the export it sits on and the file', () => {
    const text = source(
      ['A reader.', '', '@canonical A cache keyed by an object'],
      'export function perObject() {}'
    );
    expect(canonicalEntries(text, FILE)).toEqual([
      { job: 'A cache keyed by an object', note: '', name: 'perObject', file: FILE },
    ]);
  });

  it('reads the lines after the job as its note, up to the next tag', () => {
    const doc = [
      '@canonical A cache keyed by an object',
      '  It holds a WeakMap.',
      '  A throw stores nothing.',
      '@returns a reader',
    ];
    expect(canonicalEntries(source(doc, 'export const perObject = 1;'), FILE)[0].note).toBe(
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
      expect(canonicalEntries(source(['@canonical A job'], declaration), FILE)[0].name).toBe(name);
    }
  });

  it('reads a tagged export that follows the module comment', () => {
    const text = `/** The module. */\n\n${source(['@canonical A job'], 'export function joinPath() {}')}`;
    expect(canonicalEntries(text, FILE).map(({ name }) => name)).toEqual(['joinPath']);
  });

  it('reads no entry from a doc comment with no tag', () => {
    expect(canonicalEntries(source(['A reader.'], 'export function perObject() {}'), FILE)).toEqual([]);
  });

  it('refuses a tag on a declaration that is not exported, so a tag cannot name a private helper', () => {
    expect(() => canonicalEntries(source(['@canonical A job'], 'function hidden() {}'), FILE)).toThrow(
      'utils/perObject.ts:4: expected an export after the @canonical doc comment, got "function hidden() {}"'
    );
  });

  it('refuses a tag with no job', () => {
    expect(() => canonicalEntries(source(['@canonical'], 'export function perObject() {}'), FILE)).toThrow(
      'utils/perObject.ts: expected a job after @canonical on perObject, got none'
    );
  });
});

describe('renderCanonicalList', () => {
  const entry = (job, name, file, note = '') => ({ job, note, name, file });

  it('writes one line for each job, with its helpers and their file', () => {
    expect(renderCanonicalList([entry('Angles', 'degToRad', 'godot/math/math.ts')])).toBe(
      '- Angles: `degToRad` in `godot/math/math.ts`.\n'
    );
  });

  it('joins the helpers of one job in one file, and the files of one job', () => {
    const entries = [
      entry('Angles', 'degToRad', 'godot/math/math.ts'),
      entry('Angles', 'radToDeg', 'godot/math/math.ts'),
      entry('Angles', 'turns', 'godot/math/turns.ts'),
    ];
    expect(renderCanonicalList(entries)).toBe(
      '- Angles: `degToRad` and `radToDeg` in `godot/math/math.ts`, and `turns` in `godot/math/turns.ts`.\n'
    );
  });

  it('adds the note after the helpers', () => {
    expect(
      renderCanonicalList([entry('Angles', 'degToRad', 'godot/math/math.ts', 'Never divide by 180.')])
    ).toBe('- Angles: `degToRad` in `godot/math/math.ts`. Never divide by 180.\n');
  });

  it('orders the jobs by file path, with test helpers last', () => {
    const entries = [
      entry('In tests, the loads', 'settleLoads', 'r3f/testing/settleLoads.ts'),
      entry('Paths', 'joinPath', 'utils/nodePath.ts'),
      entry('Angles', 'degToRad', 'godot/math/math.ts'),
    ];
    expect(
      renderCanonicalList(entries)
        .split('\n')
        .map((line) => line.slice(0, 12))
    ).toEqual(['- Angles: `d', '- Paths: `jo', '- In tests, ', '']);
  });

  it('keeps a long entry on one line, so a grep for one word prints all of it', () => {
    const note = 'Read it with `an as const object` and a long tail of words that runs well past any edge.';
    const list = renderCanonicalList([entry('Angles', 'degToRad', 'godot/math/math.ts', note)]);
    expect(list.trimEnd().split('\n')).toHaveLength(1);
  });
});
