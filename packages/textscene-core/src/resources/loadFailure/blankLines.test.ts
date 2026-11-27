import { describe, expect, it } from 'vitest';
import { Linter } from '../../linter/Linter';
import { previewerLoadResult } from './headingSweep.testkit';

/** Codes `get_token` skips, each on a line with nothing else to read, as `blankLineSweep.mjs` writes them. */
const BLANK_CODES = { tab: '\t', code_1: '\x01', code_8: '\x08', code_31: '\x1f' };

const HEADING = '[gd_scene format=3]\n\n[node name="R" type="Node2D"]';

const BLANK_PLACES = {
  after_bracket: (code: string) => `${HEADING}${code}\nposition = Vector2(1, 2)\n`,
  body_line: (code: string) => `${HEADING}\n${code}\nposition = Vector2(1, 2)\n`,
  before_value: (code: string) => `${HEADING}\nposition =\n${code}\nVector2(1, 2)\n`,
  before_key: (code: string) => `${HEADING}\n${code}position = Vector2(1, 2)\n`,
  around_equals: (code: string) => `${HEADING}\nposition${code}=${code}Vector2(1, 2)\n`,
  after_value: (code: string) => `${HEADING}\nposition = Vector2(1, 2)${code}\n`,
  after_later_value: (code: string) => `${HEADING}\nposition =\nVector2(1, 2)${code}\n`,
  after_multiline_value: (code: string) => `${HEADING}\nposition = Vector2(\n1, 2)${code}\n`,
};

const CELLS = Object.entries(BLANK_PLACES).flatMap(([place, scene]) =>
  Object.entries(BLANK_CODES).map(([code, text]) => ({
    place,
    code,
    file: { path: `res://${place}__${code}.tscn`, text: scene(text) },
  }))
);

// Godot 4.6.3 loads every cell with the position, measured with the load oracle.
describe('a line of codes Godot skips, as Godot 4.6.3 loads it', () => {
  it.each(CELLS)('$code $place loads the body', ({ file }) => {
    expect(previewerLoadResult(file)).toBe('loads R(1.0, 2.0)');
  });

  it.each(CELLS)('$code $place raises no diagnostic', ({ file }) => {
    expect(new Linter().lint(file.text)).toEqual([]);
  });
});
