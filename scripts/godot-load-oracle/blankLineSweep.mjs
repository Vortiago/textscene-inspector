import { writeCaseFiles } from './writeCaseFiles.mjs';

/** Codes `get_token` skips, each on a line with nothing else to read. */
const BLANK_CODES = { tab: '\t', code_1: '\x01', code_8: '\x08', code_31: '\x1f' };

const HEADING = '[gd_scene format=3]\n\n[node name="R" type="Node2D"]';

/** Where the code sits: after a `]`, on a body line, around a key or its `=`, or after a value. */
const BLANK_PLACES = {
  after_bracket: (code) => `${HEADING}${code}\nposition = Vector2(1, 2)\n`,
  body_line: (code) => `${HEADING}\n${code}\nposition = Vector2(1, 2)\n`,
  before_value: (code) => `${HEADING}\nposition =\n${code}\nVector2(1, 2)\n`,
  before_key: (code) => `${HEADING}\n${code}position = Vector2(1, 2)\n`,
  around_equals: (code) => `${HEADING}\nposition${code}=${code}Vector2(1, 2)\n`,
  after_value: (code) => `${HEADING}\nposition = Vector2(1, 2)${code}\n`,
  after_later_value: (code) => `${HEADING}\nposition =\nVector2(1, 2)${code}\n`,
  after_multiline_value: (code) => `${HEADING}\nposition = Vector2(\n1, 2)${code}\n`,
};

const cases = Object.entries(BLANK_PLACES).flatMap(([place, scene]) =>
  Object.entries(BLANK_CODES).map(([code, text]) => ({ file: `${place}__${code}.tscn`, text: scene(text) }))
);
console.log(writeCaseFiles(process.argv[2], cases));
