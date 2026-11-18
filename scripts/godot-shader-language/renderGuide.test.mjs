import { describe, expect, it } from 'vitest';
import { floatText, renderGuide } from './renderGuide.mjs';

const ROWS = [
  { id: 'OP_ADD(float,float)', family: 'operator', source: 'servers/rendering/shader_language.cpp:1627' },
  { id: 'OP_SUB(float,float)', family: 'operator', source: 'servers/rendering/shader_language.cpp:1627' },
];
const PROBE = {
  name: 'add',
  rows: ['OP_ADD(float,float)'],
  source: 'float probe(float a, float b) { return a + b; }',
};
const RECORD = {
  godot: '4.6.3-stable',
  adapter: 'llvmpipe',
  probes: { add: { source: PROBE.source, inputs: [['3f800000'], ['40000000']], results: [['40400000']] } },
};
const SECTION = {
  heading: 'Add',
  rows: (row) => row.id.startsWith('OP_ADD('),
  what: 'Adds.',
  tsl: 'a.add(b)',
};
const chaptersWith = (sections) => [{ file: 'add.md', title: 'Add', intro: 'Adding.', sections }];

describe('renderGuide', () => {
  it("writes Godot's recorded values into the chapter", () => {
    const [, chapter] = renderGuide({
      chapters: chaptersWith([SECTION]),
      rows: ROWS,
      probes: [PROBE],
      record: RECORD,
    });
    expect(chapter[1]).toContain('| `1.0` | `2.0` | `3.0` |');
  });

  it('counts the transpiled rows in the index', () => {
    const [index] = renderGuide({
      chapters: chaptersWith([SECTION]),
      rows: ROWS,
      probes: [PROBE],
      record: RECORD,
    });
    expect(index[1]).toContain('| operator | 1 of 2 | #1823 |');
  });

  it('states the one Godot version every project draws as', () => {
    const [index] = renderGuide({
      chapters: chaptersWith([SECTION]),
      rows: ROWS,
      probes: [PROBE],
      record: RECORD,
      version: '4.6.3',
    });
    expect(index[1]).toContain('the previewer draws every project as Godot 4.6.3 draws it');
  });

  it("writes an int probe's lanes as ints", () => {
    const intProbe = {
      name: 'add',
      rows: ['OP_ADD(float,float)'],
      source: 'int probe(int a, int b) { return a + b; }',
    };
    const record = {
      ...RECORD,
      probes: {
        add: { source: intProbe.source, inputs: [['ffffffff'], ['00000002']], results: [['00000001']] },
      },
    };
    const [, chapter] = renderGuide({
      chapters: chaptersWith([SECTION]),
      rows: ROWS,
      probes: [intProbe],
      record,
    });
    expect(chapter[1]).toContain('| `-1` | `2` | `1` |');
  });

  it("states each row's target state", () => {
    const [, chapter] = renderGuide({
      chapters: chaptersWith([SECTION]),
      rows: ROWS,
      probes: [PROBE],
      record: RECORD,
    });
    expect(chapter[1]).toContain(
      'Every row is native on WebGL 2. WebGPURenderer runs the same nodes and is untested (#1788).'
    );
  });

  it('shows only the probes a section names, where it names its own', () => {
    const folded = { ...PROBE, name: 'fold-add', source: 'float probe(float a) { return 1.0 + 2.0; }' };
    const record = {
      ...RECORD,
      probes: {
        ...RECORD.probes,
        'fold-add': { source: folded.source, inputs: [['00000000']], results: [['40400000']] },
      },
    };
    const [, chapter] = renderGuide({
      chapters: chaptersWith([{ ...SECTION, probes: (probe) => probe.name.startsWith('fold-') }]),
      rows: ROWS,
      probes: [PROBE, folded],
      record,
    });
    expect(chapter[1]).toContain('fold-add');
    expect(chapter[1]).not.toContain('`add`');
  });

  it('fails for a transpiled row that no section explains', () => {
    expect(() =>
      renderGuide({ chapters: chaptersWith([]), rows: ROWS, probes: [PROBE], record: RECORD })
    ).toThrow(/found none for OP_ADD\(float,float\)/);
  });
});

describe('floatText', () => {
  it.each([
    [0.1, '0.1'],
    [Math.fround(1 / 3), '0.33333334'],
    [2, '2.0'],
    [-0, '-0.0'],
    [Number.NaN, 'NaN'],
    [-Infinity, '-inf'],
  ])('writes %s as %s', (value, text) => {
    expect(floatText(Math.fround(value))).toBe(text);
  });
});
