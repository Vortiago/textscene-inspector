import { describe, expect, it } from 'vitest';
import { renderTestingGuide } from './renderTestingGuide.mjs';

const KNOWN = {
  'double-negation': {
    program: 'random-1-1',
    source: 'float probe(float a0) { return -(-a0); }',
    lane: 'lane 0',
    cause: 'c',
    owner: '#1',
  },
};

const INPUT = {
  operators: {
    cases: [{ id: 'OP_ADD(float,float)', row: {} }],
    record: { godot: '4.6.3-stable', cases: { 'OP_ADD(float,float)': 'accepted' } },
  },
  random: {
    programs: [{}, {}, { functions: 2 }],
    seed: 1,
    transpiledRows: 2,
    knownDifferences: KNOWN,
    loweredAway: { FLOW_OP_FOR: { keyword: 'for' }, FLOW_OP_SWITCH: { keyword: 'switch' } },
  },
  corpus: {
    corpus: [
      { id: 'demos/a.gdshader', shaderType: 'spatial' },
      { id: 'rejected/demos/a.gdshader', shaderType: 'spatial', changedFrom: 'demos/a.gdshader' },
    ],
    corpusRecord: { cases: { 'demos/a.gdshader': 'accepted', 'rejected/demos/a.gdshader': 'line 1: x' } },
    states: {
      'demos/a.gdshader': 'not transpiled yet (#1794)',
      'rejected/demos/a.gdshader': 'not transpiled yet (#1794)',
    },
    knownMismatches: {},
  },
};

const GUIDE = renderTestingGuide(INPUT);

describe('the chapter on the tests against Godot', () => {
  it('counts the random programs that declare functions of their own', () => {
    expect(GUIDE).toContain('the rest with random roots, and 1 that declare functions of their own.');
  });

  it('counts the random programs bit-equal with Godot, less those a case names, and the listed cases', () => {
    expect(GUIDE).toContain(
      '**2 of 3 random programs bit-equal with Godot, NaN lanes compared as NaN. The others are the 1 listed known-difference case, each with its cause:'
    );
  });

  it('counts the real shaders that transpile, of those Godot accepts', () => {
    expect(GUIDE).toContain('**0 of 1 real shaders transpile.** Godot rejects the other 1.');
  });

  it('names the flows the lowering removes from the list the tree check reads', () => {
    expect(GUIDE).toContain(
      'After lowering, the tree holds no `for` or `switch`, its one loop is `while (true)`'
    );
  });

  it('names the folder of the printed corpus trees', () => {
    expect(GUIDE).toContain('is a checked-in file under `tests/corpus/trees/`');
  });

  it('says a missing Godot fails the job instead of passing on the smoke subset', () => {
    expect(GUIDE).toContain('It also fails when Godot is missing');
  });

  it('lists each shader not transpiled yet with its owner', () => {
    expect(GUIDE).toContain('| `demos/a.gdshader` | #1794 |');
  });
});

describe('the table of known differences', () => {
  it('escapes a pipe in a reduced program, so the cell holds the whole program', () => {
    const guide = renderTestingGuide({
      operators: { cases: [], record: { godot: '4.6.3-stable', cases: {} } },
      random: {
        programs: [{}],
        seed: 1,
        transpiledRows: 1,
        loweredAway: { FLOW_OP_FOR: { keyword: 'for' } },
        knownDifferences: {
          'random-1-0': {
            source: 'bool probe(bool a0) { return a0 || a0; }',
            lane: 'l',
            cause: 'c',
            owner: '#1',
          },
        },
      },
      corpus: { corpus: [], corpusRecord: { cases: {} }, states: {}, knownMismatches: {} },
    });
    expect(guide).toContain('`bool probe(bool a0) { return a0 \\|\\| a0; }`');
  });

  it('says the folder of printed trees is empty while no shader transpiles', () => {
    expect(GUIDE).toContain('No shader transpiles yet, so the folder holds no file yet.');
  });

  it('counts the printed tree files once a shader transpiles', () => {
    const states = { ...INPUT.corpus.states, 'demos/a.gdshader': 'transpiled' };
    const guide = renderTestingGuide({ ...INPUT, corpus: { ...INPUT.corpus, states } });
    expect(guide).toContain('It holds 1 file.');
  });
});
