import { describe, expect, it } from 'vitest';
import { renderTestingGuide } from './renderTestingGuide.mjs';

const KNOWN = {
  'random-1-1': {
    reduced: 'float probe(float a0) { return -(-a0); }',
    lane: 'lane 0',
    cause: 'c',
    owner: '#1',
  },
};

const GUIDE = renderTestingGuide({
  operators: {
    cases: [{ id: 'OP_ADD(float,float)', row: {} }],
    record: { godot: '4.6.3-stable', cases: { 'OP_ADD(float,float)': 'accepted' } },
  },
  random: { programs: [{}, {}, {}], seed: 1, translatedRows: 2, knownDifferences: KNOWN },
  corpus: {
    corpus: [
      { id: 'demos/a.gdshader', shaderType: 'spatial' },
      { id: 'rejected/demos/a.gdshader', shaderType: 'spatial', changedFrom: 'demos/a.gdshader' },
    ],
    corpusRecord: { cases: { 'demos/a.gdshader': 'accepted', 'rejected/demos/a.gdshader': 'line 1: x' } },
    states: {
      'demos/a.gdshader': 'not translated yet (#1794)',
      'rejected/demos/a.gdshader': 'not translated yet (#1794)',
    },
    knownMismatches: {},
  },
});

describe('the chapter on the tests against Godot', () => {
  it('counts the random programs bit-equal with Godot, less the known differences', () => {
    expect(GUIDE).toContain('**2 of 3 random programs bit-equal with Godot.**');
  });

  it('counts the real shaders that translate, of those Godot accepts', () => {
    expect(GUIDE).toContain('**0 of 1 real shaders translate.** Godot rejects the other 1.');
  });

  it('lists each shader not translated yet with its owner', () => {
    expect(GUIDE).toContain('| `demos/a.gdshader` | #1794 |');
  });
});
