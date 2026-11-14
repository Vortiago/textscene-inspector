import { describe, expect, it } from 'vitest';
import { splitStages, type StageLine } from './stages.js';

const files = (entries: Record<string, string>) => (path: string) => entries[path];
const texts = (lines: readonly StageLine[] | undefined) => lines?.map((line) => line.text);

describe('splitStages', () => {
  it('cuts a file at its stage markers', () => {
    const stages = splitStages('a.glsl', files({ 'a.glsl': '#[vertex]\nv();\n#[fragment]\nf();\n' }));
    expect(texts(stages.vertex)).toEqual(['v();']);
    expect(texts(stages.fragment)).toEqual(['f();']);
    expect(stages.compute).toBeUndefined();
  });

  it('leaves out the lines before the first marker', () => {
    const stages = splitStages('a.glsl', files({ 'a.glsl': 'before\n#[compute]\nc();\n' }));
    expect(texts(stages.compute)).toEqual(['c();']);
  });

  it('cuts each line at its comment', () => {
    const stages = splitStages('a.glsl', files({ 'a.glsl': '#[compute]\nc(); // why\n' }));
    expect(texts(stages.compute)).toEqual(['c(); ']);
  });

  it('keeps the file and the line of each line', () => {
    const stages = splitStages('a.glsl', files({ 'a.glsl': '#[compute]\n\nc();\n' }));
    expect(stages.compute?.[1]).toEqual({ text: 'c();', file: 'a.glsl', line: 3 });
  });

  it('reads an include in place, relative to the including file', () => {
    const read = files({
      'dir/a.glsl': '#[compute]\n#include "../b_inc.glsl"\nc();\n',
      'b_inc.glsl': 'b();\n',
    });
    const stages = splitStages('dir/a.glsl', read);
    expect(stages.compute?.map(({ text, file }) => [text, file])).toEqual([
      ['b();', 'b_inc.glsl'],
      ['c();', 'dir/a.glsl'],
    ]);
  });

  it('reads an include once in each stage', () => {
    const read = files({
      'a.glsl': '#[vertex]\n#include "b.glsl"\n#include "b.glsl"\nv();\n#[fragment]\n#include "b.glsl"\n',
      'b.glsl': 'b();\n',
    });
    const stages = splitStages('a.glsl', read);
    expect(texts(stages.vertex)).toEqual(['b();', 'v();']);
    expect(texts(stages.fragment)).toEqual(['b();', '']);
  });

  it('keeps the comment on the line after an include, as Godot does', () => {
    const read = files({ 'a.glsl': '#[compute]\n#include "b.glsl"\nc(); // kept\n', 'b.glsl': '' });
    expect(texts(splitStages('a.glsl', read).compute)).toEqual(['c(); // kept']);
  });

  it('names the file of an include it cannot find', () => {
    const read = files({ 'a.glsl': '#[compute]\n#include "missing.glsl"\n' });
    expect(() => splitStages('a.glsl', read)).toThrow(
      'In file "a.glsl": #include "missing.glsl" could not be found!'
    );
  });
});
