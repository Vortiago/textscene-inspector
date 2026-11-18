import { describe, expect, it } from 'vitest';
import { renderBuiltinTypes } from './run.mjs';

const vector2 = {
  name: 'Vector2',
  members: [['x', 'float']],
  indexing: 'float',
  isKeyed: false,
  methods: [['angle', 'float', 1, 466405837, []]],
};

describe('renderBuiltinTypes', () => {
  it('writes a type row keyed by its Godot name, with each method on its own line', () => {
    expect(renderBuiltinTypes([vector2])).toContain(`  Vector2: {
    members: [["x","float"]],
    indexing: "float",
    isKeyed: false,
    methods: [
      ["angle","float",1,466405837,[]],
    ],
  },`);
  });

  it('writes an empty method list on one line', () => {
    expect(renderBuiltinTypes([{ ...vector2, methods: [] }])).toContain('    methods: [],');
  });
});
